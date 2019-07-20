import deepFreeze from 'deep-freeze-strict';
import flatCache from 'flat-cache';
import got from 'got';
import Metalsmith from 'metalsmith';

import { getFirstParentCommits } from './git';
import { NetlifyDeployData, netlifyDeploys } from './netlify';
import { isObject, joinURL, path2url } from './utils';
import { buf2json, json2buf } from './utils/buf-json';
import {
    createPluginGenerator,
    FileInterface,
    getMatchedFiles,
    isFile,
} from './utils/metalsmith';
import { DeepReadonly } from './utils/types';

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
          cachedResponse: CachedResponseInterface;
      });

export interface CachedResponseInterface {
    body: Buffer;
    published: string;
}

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

export function getCachedResponse(
    value: unknown,
): CachedResponseInterface | null {
    if (isObject(value)) {
        const { published } = value;
        if (typeof published === 'string') {
            const body = json2buf(value.body);
            if (body) {
                return {
                    body,
                    published,
                };
            }
        }
    }
    return null;
}

export async function getDeployList(
    siteID: string,
    accessToken: string | null,
): ReturnType<typeof netlifyDeploys> {
    const commitList = await getFirstParentCommits();
    const deployList = await netlifyDeploys(siteID, {
        accessToken,
        commitHashList: commitList.map(commit => commit.hash),
    });
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
    cache: flatCache.Cache;
    deployList: ReturnType<typeof getDeployList>;
    metalsmith: Metalsmith;
    files: Metalsmith.Files;
    filename: string;
}): Promise<void> {
    const fileData = files[filename];
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

        const cachedResponse = getCachedResponse(cache.getKey(deployedPageURL));
        if (cachedResponse) {
            /*
             * Set the published date value from cached data.
             */
            published = cachedResponse.published;

            /*
             * If only the published date of this page is searching, the subsequent loop is ended.
             */
            if (searchOnlyPublished) {
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
                modified = published;
            } else {
                /*
                 * If the contents are different, the search for the modified date is ended.
                 * From this point on, only the published date of this page is searched.
                 */
                searchOnlyPublished = true;
            }
        } else {
            const deployedPageResponse = await fetchPage(deployedPageURL);

            /*
             * If the page does not found (404 Not Found), end the search.
             */
            if (!deployedPageResponse) {
                break;
            }

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
                modified = published;
            } else {
                /*
                 * If the contents are different, the search for the modified date is ended.
                 * From this point on, only the published date of this page is searched.
                 */
                searchOnlyPublished = true;
            }
        }
    }

    if (published) {
        const publishedStr = published;
        deployedPageResponseMap.forEach((body, deployedPageURL) => {
            const data: CachedResponseInterface = {
                body,
                published: publishedStr,
            };
            cache.setKey(deployedPageURL, {
                ...data,
                body: buf2json(data.body),
            });
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
    const options = { ...defaultOptions, ...opts };
    const cache = flatCache.create(
        'metalsmith-netlify-published-date',
        options.cacheDir || undefined,
    );
    const deployList = getDeployList(options.siteID, options.accessToken);

    return (files, metalsmith, done) => {
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
                done(null, files, metalsmith);
            })
            .catch(error => done(error, files, metalsmith));
    };
}, defaultOptions);
