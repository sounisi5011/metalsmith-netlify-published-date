import deepFreeze from 'deep-freeze-strict';
import got from 'got';
import Metalsmith from 'metalsmith';

import PreviewCache, { CachedPreviewResponseInterface } from './cache/preview';
import { getFirstParentCommits } from './git';
import { NetlifyDeployData, netlifyDeploys } from './netlify';
import { joinURL, path2url } from './utils';
import { debug as log } from './utils/log';
import {
    createPluginGenerator,
    FileInterface,
    getMatchedFiles,
    isFile,
} from './utils/metalsmith';
import { DeepReadonly } from './utils/types';

const fileLog = log.extend('file');
const previewLog = log.extend('netlify-preview');

/*
 * Interfaces
 */

export type OptionsInterface = DeepReadonly<WritableOptionsInterface>;

export interface WritableOptionsInterface {
    pattern: string | string[];
    siteID: string;
    accessToken: string | null;
    cacheDir: string | null;
    defaultDate:
        | ((metadata: GeneratingPageMetadataInterface) => unknown)
        | Date
        | null;
    filename2urlPath(
        filename: string,
        metadata: Omit<GeneratingPageMetadataInterface, 'filename'>,
    ): string | Promise<string>;
    contentsConverter(
        contents: Buffer,
        metadata:
            | GeneratingPageMetadataInterface
            | DeployedPageMetadataInterface,
    ): Buffer | Promise<Buffer>;
    contentsEquals(arg: {
        file: Buffer;
        deployedPage: Buffer;
        metadata: DeployedPageMetadataInterface &
            GeneratingPageMetadataInterface;
    }): boolean | Promise<boolean>;
}

export interface GeneratingPageMetadataInterface {
    files: Metalsmith.Files;
    filename: string;
    fileData: FileInterface;
    metalsmith: Metalsmith;
}

export type DeployedPageMetadataInterface = {
    deploy: NetlifyDeployData;
} & (
    | {
          deployedPageResponse: got.Response<Buffer>;
          cachedResponse: null;
      }
    | {
          deployedPageResponse: null;
          cachedResponse: CachedPreviewResponseInterface;
      });

/*
 * Utility functions
 */

export function defaultDate2value<
    TFuncRet,
    TNotFunc extends DeepReadonly<Date>,
    TMeta
>({
    dateStr,
    defaultDate,
    nowDate,
    metadata,
}: {
    dateStr: string | null;
    defaultDate: ((metadata: TMeta) => TFuncRet) | TNotFunc | null | undefined;
    nowDate: number;
    metadata: TMeta;
}): Date | TFuncRet | TNotFunc {
    if (dateStr) {
        return new Date(dateStr);
    }

    if (defaultDate !== null && defaultDate !== undefined) {
        const dateValue =
            typeof defaultDate === 'function'
                ? defaultDate(metadata)
                : defaultDate;
        return dateValue;
    }

    return new Date(nowDate);
}

export async function getDeployList(
    siteID: string,
    accessToken: string | null,
): ReturnType<typeof netlifyDeploys> {
    const commitList = await getFirstParentCommits();
    log("got Git's commits hash");

    const deployList = await netlifyDeploys(siteID, {
        accessToken,
        commitHashList: commitList.map(commit => commit.hash),
    });
    log('fetched Netlify deploys');

    return deployList;
}

export async function fetchPage(
    url: string,
): Promise<got.Response<Buffer> | null> {
    try {
        return await got(url, { encoding: null });
    } catch (error) {
        if (error instanceof got.HTTPError) {
            if (error.statusCode === 404) {
                return null;
            }
        }
        throw error;
    }
}

export async function eachFile({
    options,
    nowDate,
    cache,
    deployList,
    metalsmith,
    files,
    filename,
}: {
    options: OptionsInterface;
    nowDate: number;
    cache: PreviewCache;
    deployList: ReturnType<typeof getDeployList>;
    metalsmith: Metalsmith;
    files: Metalsmith.Files;
    filename: string;
}): Promise<void> {
    const fileData = files[filename];

    fileLog('%s / checking file', filename);
    if (!isFile(fileData)) {
        return;
    }

    const urlPath = path2url(
        await options.filename2urlPath(filename, {
            files,
            fileData,
            metalsmith,
        }),
    );
    fileLog('%s / get URL Path: %s', filename, urlPath);

    const fileContents = await options.contentsConverter(fileData.contents, {
        files,
        filename,
        fileData,
        metalsmith,
    });

    let published: string | null = null;
    let modified: string | null = null;
    let searchOnlyPublished = false;
    const deployedPageResponseMap = new Map<string, Buffer>();

    for (const deploy of await deployList) {
        const deployedPageURL = joinURL(deploy.deployAbsoluteURL, urlPath);

        const cachedResponse = cache.get(deployedPageURL);
        if (cachedResponse) {
            previewLog('%s / fetchd from cache', deployedPageURL);

            /*
             * Set the published date value from cached data.
             */
            published = cachedResponse.published;

            /*
             * If only the published date of this page is searching, the subsequent loop is ended.
             */
            if (searchOnlyPublished) {
                fileLog(
                    '%s / published date is established: %s',
                    filename,
                    published,
                );
                break;
            }

            /*
             * Compare file and deployed page contents.
             */
            const deployedPageContents = await options.contentsConverter(
                cachedResponse.body,
                { deploy, deployedPageResponse: null, cachedResponse },
            );
            if (
                await options.contentsEquals({
                    file: fileContents,
                    deployedPage: deployedPageContents,
                    metadata: {
                        deploy,
                        deployedPageResponse: null,
                        cachedResponse,
                        files,
                        filename,
                        fileData,
                        metalsmith,
                    },
                })
            ) {
                /*
                 * If the contents are different, set the deployed date of the previous file as the modified date.
                 */
                fileLog(
                    '%s / matched the content of preview %s',
                    filename,
                    deployedPageURL,
                );
                previewLog(
                    '%s / matched the content of file %s',
                    deployedPageURL,
                    filename,
                );
                modified = published;
            } else {
                /*
                 * If the contents are different, the search for the modified date is ended.
                 * From this point on, only the published date of this page is searched.
                 */
                fileLog(
                    '%s / did not match the content of preview %s',
                    filename,
                    deployedPageURL,
                );
                previewLog(
                    '%s / did not match the content of file %s',
                    deployedPageURL,
                    filename,
                );
                searchOnlyPublished = true;
                fileLog(
                    '%s / modified date is established: %s',
                    filename,
                    modified,
                );
            }
        } else {
            const deployedPageResponse = await fetchPage(deployedPageURL);

            /*
             * If the page does not found (404 Not Found), end the search.
             */
            if (!deployedPageResponse) {
                previewLog('%s / 404 Not Found', deployedPageURL);
                fileLog(
                    '%s / published date is established: %s',
                    filename,
                    published,
                );
                break;
            }
            previewLog('%s / fetchd', deployedPageURL);

            new Set([
                deployedPageURL,
                deployedPageResponse.requestUrl,
                ...(deployedPageResponse.redirectUrls || []),
                deployedPageResponse.url,
            ]).forEach(deployedPageURL => {
                deployedPageResponseMap.set(
                    deployedPageURL,
                    deployedPageResponse.body,
                );
            });
            previewLog('%s / enqueue to queue for cache', deployedPageURL);

            /*
             * Set the published date value from published date of current deploy.
             * Note: This value is the release date of the snapshot built with Netlify.
             *       It is not the date when the page was published on the Internet.
             *       Therefore, in order to determine when a page was published, it is necessary to detect a snapshot in which the page does not exist.
             */
            published = deploy.published_at || deploy.created_at;

            /*
             * If only the published date of this page is searching, the subsequent processing is skipped.
             */
            if (searchOnlyPublished) {
                continue;
            }

            /*
             * Compare file and deployed page contents.
             */
            const deployedPageContents = await options.contentsConverter(
                deployedPageResponse.body,
                { deploy, deployedPageResponse, cachedResponse: null },
            );
            if (
                await options.contentsEquals({
                    file: fileContents,
                    deployedPage: deployedPageContents,
                    metadata: {
                        deploy,
                        deployedPageResponse,
                        cachedResponse: null,
                        files,
                        filename,
                        fileData,
                        metalsmith,
                    },
                })
            ) {
                /*
                 * If the contents are different, set the deployed date of the previous file as the modified date.
                 */
                fileLog(
                    '%s / matched the content of preview %s',
                    filename,
                    deployedPageURL,
                );
                previewLog(
                    '%s / matched the content of file %s',
                    deployedPageURL,
                    filename,
                );
                modified = published;
            } else {
                /*
                 * If the contents are different, the search for the modified date is ended.
                 * From this point on, only the published date of this page is searched.
                 */
                fileLog(
                    '%s / did not match the content of preview %s',
                    filename,
                    deployedPageURL,
                );
                previewLog(
                    '%s / did not match the content of file %s',
                    deployedPageURL,
                    filename,
                );
                searchOnlyPublished = true;
                fileLog(
                    '%s / modified date is established: %s',
                    filename,
                    modified,
                );
            }
        }
    }

    if (published) {
        const publishedStr = published;
        deployedPageResponseMap.forEach((body, deployedPageURL) => {
            const data: CachedPreviewResponseInterface = {
                body,
                published: publishedStr,
            };
            cache.set(deployedPageURL, data);
            previewLog('%s / stored in cache', deployedPageURL);
        });
    }

    fileData.published = defaultDate2value({
        dateStr: published,
        defaultDate: options.defaultDate,
        nowDate,
        metadata: {
            files,
            filename,
            fileData,
            metalsmith,
        },
    });
    fileData.modified = defaultDate2value({
        dateStr: modified,
        defaultDate: options.defaultDate,
        nowDate,
        metadata: {
            files,
            filename,
            fileData,
            metalsmith,
        },
    });
    fileLog('%s / stored metadata: %o', filename, {
        published: fileData.published,
        modified: fileData.modified,
    });
}

/*
 * Default options
 */

const netlifyRootURL = process.env.URL;
const netlifyRootURLMatch = /^https:[/]{2}([^/]+)/.exec(netlifyRootURL || '');
const defaultSiteID = (netlifyRootURLMatch && netlifyRootURLMatch[1]) || '';

export const defaultOptions: OptionsInterface = deepFreeze({
    pattern: ['**/*.html'],
    siteID: defaultSiteID,
    accessToken: null,
    cacheDir: null,
    defaultDate: null,
    filename2urlPath: filename => filename,
    contentsConverter: contents => contents,
    contentsEquals: ({ file, deployedPage }) => file.equals(deployedPage),
});

/*
 * Main function
 */

export default createPluginGenerator((opts = {}) => {
    log('initialize plugin');

    const options = { ...defaultOptions, ...opts };
    const cache = new PreviewCache(options.cacheDir);
    const deployList = getDeployList(options.siteID, options.accessToken);

    return (files, metalsmith, done) => {
        log('start plugin processing');

        const nowDate = Date.now();
        const matchedFiles = getMatchedFiles(files, options.pattern);
        Promise.all(
            matchedFiles.map(async filename =>
                eachFile({
                    options,
                    nowDate,
                    cache,
                    deployList,
                    metalsmith,
                    files,
                    filename,
                }),
            ),
        )
            .then(() => {
                cache.save();
                log('complete plugin processing');
                done(null, files, metalsmith);
            })
            .catch(error => done(error, files, metalsmith));
    };
}, defaultOptions);
