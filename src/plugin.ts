import deepFreeze from 'deep-freeze-strict';
import got from 'got';
import Metalsmith from 'metalsmith';
import path from 'path';

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
        previewPage: Buffer;
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
          previewPageResponse: got.Response<Buffer>;
          cachedResponse: null;
      }
    | {
          previewPageResponse: null;
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

export function publishedDate(deploy: NetlifyDeployData): string {
    return deploy.published_at || deploy.created_at;
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
    let modifiedDateEstablished = false;
    const previewPageResponseMap = new Map<string, Buffer>();

    for (const deploy of await deployList) {
        const previewPageURL = joinURL(deploy.deployAbsoluteURL, urlPath);

        const cachedResponse = cache.get(previewPageURL);
        if (cachedResponse) {
            previewLog('%s / fetchd from cache', previewPageURL);

            /*
             * Set the published date value from cached data.
             * Note: This value is the date the web page was published on the Internet.
             *       Therefore, the search for the published date is complete here.
             */
            published = cachedResponse.published;

            /*
             * If the modified date is not established, verifying that the file and preview content are equals.
             * If the content does not equals, the current deploy published date will be the modified date.
             */
            if (!modifiedDateEstablished) {
                /*
                 * Verify the file contents and preview page contents are equals.
                 */
                const previewPageContents = await options.contentsConverter(
                    cachedResponse.body,
                    { deploy, previewPageResponse: null, cachedResponse },
                );
                if (
                    await options.contentsEquals({
                        file: fileContents,
                        previewPage: previewPageContents,
                        metadata: {
                            deploy,
                            previewPageResponse: null,
                            cachedResponse,
                            files,
                            filename,
                            fileData,
                            metalsmith,
                        },
                    })
                ) {
                    /*
                     * If the contents are equals, set the published date of the current deploy as the modified date.
                     */
                    fileLog(
                        '%s / matched the content of preview %s',
                        filename,
                        previewPageURL,
                    );
                    previewLog(
                        '%s / matched the content of file %s',
                        previewPageURL,
                        filename,
                    );

                    modified = publishedDate(deploy);
                } else {
                    /*
                     * If the contents are different, modified date is established.
                     */
                    fileLog(
                        '%s / did not match the content of preview %s',
                        filename,
                        previewPageURL,
                    );
                    previewLog(
                        '%s / did not match the content of file %s',
                        previewPageURL,
                        filename,
                    );

                    modifiedDateEstablished = true;
                    fileLog(
                        '%s / published date and modified date is established: %s / %s',
                        filename,
                        published,
                        modified,
                    );
                }
            }

            /*
             * If published date and modified date are established, end the search.
             */
            if (modifiedDateEstablished) {
                break;
            }
        } else {
            const previewPageResponse = await fetchPage(previewPageURL);

            /*
             * If the preview page does not found (404 Not Found), end the search.
             */
            if (!previewPageResponse) {
                previewLog('%s / 404 Not Found', previewPageURL);

                if (modifiedDateEstablished) {
                    fileLog(
                        '%s / published date is established: %s',
                        filename,
                        published,
                    );
                } else {
                    fileLog(
                        '%s / published date and modified date is established: %s / %s',
                        filename,
                        published,
                        modified,
                    );
                }
                break;
            }
            previewLog('%s / fetchd', previewPageURL);

            new Set([
                previewPageURL,
                previewPageResponse.requestUrl,
                ...(previewPageResponse.redirectUrls || []),
                previewPageResponse.url,
            ]).forEach(previewPageURL => {
                previewPageResponseMap.set(
                    previewPageURL,
                    previewPageResponse.body,
                );
            });
            previewLog('%s / enqueue to queue for cache', previewPageURL);

            /*
             * Set the published date value from published date of current deploy.
             * Note: This value is the release date of the snapshot built with Netlify.
             *       It is not the date when the page was published on the Internet.
             *       Therefore, in order to determine when a page was published, it is necessary to detect a snapshot in which the page does not exist.
             */
            published = publishedDate(deploy);

            /*
             * If the modified date is not established, verifying that the file and preview content are equals.
             * If the content does not equals, the current deploy published date will be the modified date.
             */
            if (!modifiedDateEstablished) {
                /*
                 * Verify the file contents and preview page contents are equals.
                 */
                const previewPageContents = await options.contentsConverter(
                    previewPageResponse.body,
                    { deploy, previewPageResponse, cachedResponse: null },
                );
                if (
                    await options.contentsEquals({
                        file: fileContents,
                        previewPage: previewPageContents,
                        metadata: {
                            deploy,
                            previewPageResponse,
                            cachedResponse: null,
                            files,
                            filename,
                            fileData,
                            metalsmith,
                        },
                    })
                ) {
                    /*
                     * If the contents are equals, set the published date of the current deploy as the modified date.
                     */
                    fileLog(
                        '%s / matched the content of preview %s',
                        filename,
                        previewPageURL,
                    );
                    previewLog(
                        '%s / matched the content of file %s',
                        previewPageURL,
                        filename,
                    );

                    modified = published;
                } else {
                    /*
                     * If the contents are different, modified date is established.
                     * From this point on, only the published date of this page is searched.
                     */
                    fileLog(
                        '%s / did not match the content of preview %s',
                        filename,
                        previewPageURL,
                    );
                    previewLog(
                        '%s / did not match the content of file %s',
                        previewPageURL,
                        filename,
                    );

                    modifiedDateEstablished = true;
                    fileLog(
                        '%s / modified date is established: %s',
                        filename,
                        modified,
                    );
                }
            }
        }
    }

    if (published) {
        const publishedStr = published;
        previewPageResponseMap.forEach((body, previewPageURL) => {
            const data: CachedPreviewResponseInterface = {
                body,
                published: publishedStr,
            };
            cache.set(previewPageURL, data);
            previewLog('%s / stored in cache', previewPageURL);
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
    cacheDir: path.resolve(__dirname, '../.cache/'),
    defaultDate: null,
    filename2urlPath: filename => filename,
    contentsConverter: contents => contents,
    contentsEquals: ({ file, previewPage }) => file.equals(previewPage),
});

/*
 * Main function
 */

export default createPluginGenerator((opts = {}) => {
    log('initialize plugin');

    const options = { ...defaultOptions, ...opts };
    const cache = new PreviewCache(options.cacheDir);

    return (files, metalsmith, done) => {
        log('start plugin processing');

        const nowDate = Date.now();
        const matchedFiles = getMatchedFiles(files, options.pattern);
        const deployList =
            matchedFiles.length >= 1
                ? getDeployList(options.siteID, options.accessToken)
                : Promise.resolve([]);
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
