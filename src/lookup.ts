import Metalsmith from 'metalsmith';
import { ObjectState } from 'object-rollback';
import { URL } from 'url';

import PreviewCache, { CachedPreviewResponseInterface } from './cache/preview';
import { getFirstParentCommits } from './git';
import { NetlifyDeployData, netlifyDeploys } from './netlify';
import { OptionsInterface, setMetadata } from './plugin';
import {
    findEqualsPath,
    isNotVoid,
    joinURL,
    MapWithDefault,
    pickProps,
    toBuffer,
    url2path,
} from './utils';
import { MultiFetchResult, redirectFetch } from './utils/fetch';
import { debug } from './utils/log';
import { isFile, processFiles } from './utils/metalsmith';

const log = debug.extend('lookup');
const processLog = log.extend('process');
const fileLog = log.extend('file');
const fileMetadataLog = fileLog.extend('metadata');
const fileCompareLog = fileLog.extend('compare');
const previewLog = log.extend('netlify-preview');
const previewCacheLog = previewLog.extend('cache');
const previewRequestLog = previewLog.extend('request');
const previewResponseLog = previewLog.extend('response');
const previewResponseHeadersLog = previewResponseLog.extend('headers');
const previewResponseErrorLog = previewResponseLog.extend('error');

export interface FileMetadataInterface {
    published: string | null;
    modified: string | null;
}

export type PreviewDataType =
    | PreviewDataInterface
    | PreviewNotFoundDataInterface
    | PreviewCacheDataInterface;

export interface PreviewBaseDataInterface {
    filename: string;
    urlpath: string;
    previewPageURL: string;
    contents: Buffer | null;
    previewPageResponse: MultiFetchResult | null;
    cachedResponse: CachedPreviewResponseInterface | null;
    previewPageNotFound: boolean;
    fromCache: boolean;
}

export interface PreviewDataInterface extends PreviewBaseDataInterface {
    metadata: { published: string; modified: string };
    contents: Buffer;
    previewPageResponse: MultiFetchResult;
    cachedResponse: null;
    previewPageNotFound: false;
    fromCache: false;
}

export interface PreviewNotFoundDataInterface extends PreviewBaseDataInterface {
    contents: null;
    previewPageResponse: null;
    cachedResponse: null;
    previewPageNotFound: true;
    fromCache: false;
}

export interface PreviewCacheDataInterface extends PreviewBaseDataInterface {
    metadata: { published: string };
    contents: Buffer;
    previewPageResponse: null;
    cachedResponse: CachedPreviewResponseInterface;
    previewPageNotFound: false;
    fromCache: true;
}

export interface FileDateStateInterface {
    published: DateState;
    modified: DateState;
    notFoundDetected: boolean;
}

export class DateState {
    private _date: string | null;
    private _isEstablished: boolean;

    public constructor() {
        this._date = null;
        this._isEstablished = false;
    }

    public get date(): string | null {
        return this._date;
    }

    public set date(datestr: string | null) {
        if (!this.established) {
            this._date = datestr;
        }
    }

    public get established(): boolean {
        return this._isEstablished;
    }

    public set established(isEstablished: boolean) {
        if (isEstablished) {
            this._isEstablished = true;
        }
    }
}

export function isEstablished(dateState: FileDateStateInterface): boolean {
    return dateState.published.established && dateState.modified.established;
}

export function isAllfileModifiedEstablished(
    dateStateMap: Map<string, FileDateStateInterface>,
): boolean {
    return [...dateStateMap.values()].every(
        dateState => dateState.modified.established,
    );
}

export function isAllfileEstablished(
    dateStateMap: Map<string, FileDateStateInterface>,
): boolean {
    return [...dateStateMap.values()].every(isEstablished);
}

export function publishedDate(deploy: NetlifyDeployData): string {
    return deploy.published_at || deploy.created_at;
}

// TODO: Make it user-definable
export function previewPageURL2filename(
    previewPageURL: string,
    pathList: readonly string[],
    baseDirpath: string,
): string | null {
    const urlpath = new URL(previewPageURL).pathname;

    for (const filepath of [
        url2path(urlpath.replace(/^\/+/, '')),
        url2path(urlpath.replace(/\/*$/, '/index.html').replace(/^\/+/, '')),
    ]) {
        const filename = findEqualsPath(baseDirpath, filepath, pathList);
        if (filename !== undefined) {
            return filename;
        }
    }

    return null;
}

export async function* getDeployList({
    siteID,
    accessToken,
}: {
    siteID: string;
    accessToken: string | null;
}): ReturnType<typeof netlifyDeploys> {
    const commitList = await getFirstParentCommits();
    log("got Git's commits hash");

    yield* netlifyDeploys(siteID, {
        accessToken,
        commitHashList: commitList.map(commit => commit.hash),
    });
    log('fetched all Netlify deploys');
}

export async function fetchPageData({
    filename,
    urlpath,
    previewPageURL,
    deploy,
    cache,
}: {
    filename: string;
    urlpath: string;
    previewPageURL: string;
    deploy: NetlifyDeployData;
    cache: PreviewCache;
}): Promise<PreviewDataType> {
    const cachedResponse = cache.get(previewPageURL);
    if (cachedResponse) {
        previewCacheLog('fetch from cache / %s', previewPageURL);

        const contents = cachedResponse.body;

        const ret: PreviewCacheDataInterface = {
            filename,
            urlpath,
            previewPageURL,
            previewPageResponse: null,
            cachedResponse,
            contents,
            metadata: { published: cachedResponse.published },
            previewPageNotFound: false,
            fromCache: true,
        };
        return ret;
    }

    previewRequestLog('GET %s', previewPageURL);
    const previewPageResult = await redirectFetch(previewPageURL).catch(
        error => {
            previewResponseErrorLog(
                'fetch failed by http/https module error / %s / %o',
                previewPageURL,
                error,
            );
            if (error instanceof Error) {
                error.message = `Fetching a page on Netlify failed. ${error.message}`;
            }
            throw error;
        },
    );

    if (!previewPageResult.isOk) {
        previewResponseLog(
            'fetch fails with HTTP %s %s / %s',
            previewPageResult.statusCode,
            previewPageResult.statusMessage,
            previewPageURL,
        );

        if (previewPageResult.statusCode === 404) {
            const ret: PreviewNotFoundDataInterface = {
                filename,
                urlpath,
                previewPageURL,
                previewPageResponse: null,
                cachedResponse: null,
                contents: null,
                previewPageNotFound: true,
                fromCache: false,
            };
            return ret;
        } else {
            previewResponseHeadersLog(
                'headers of %s / %O',
                previewPageURL,
                previewPageResult.headers,
            );
            throw new Error(
                'Fetching preview page on Netlify failed. HTTP response status is: ' +
                    `${previewPageResult.statusCode} ${previewPageResult.statusMessage} ; ${previewPageURL}`,
            );
        }
    }
    previewResponseLog('fetch is successful / %s', previewPageURL);

    const published = publishedDate(deploy);
    const modified = publishedDate(deploy);
    const contents = await Promise.resolve(previewPageResult.getBody())
        .then(toBuffer)
        .catch(error => {
            previewResponseErrorLog(
                'failed to read response body / %s / %o',
                previewPageURL,
                error,
            );
            if (error instanceof Error) {
                error.message = `Fetching preview page on Netlify failed. Failed to read response body: ${previewPageURL} ; ${error.message}`;
            }
            throw error;
        });

    const ret: PreviewDataInterface = {
        filename,
        urlpath,
        previewPageURL,
        previewPageResponse: previewPageResult,
        cachedResponse: null,
        contents,
        metadata: { published, modified },
        previewPageNotFound: false,
        fromCache: false,
    };
    return ret;
}

export async function getPreviewDataList({
    targetFileList,
    files,
    dateStateMap,
    deploy,
    pluginOptions,
    metalsmith,
    cache,
    cacheQueue,
    nowDate,
}: {
    targetFileList: readonly { filename: string; urlpath: string }[];
    files: Metalsmith.Files;
    dateStateMap: MapWithDefault<string, FileDateStateInterface>;
    deploy: NetlifyDeployData;
    pluginOptions: OptionsInterface;
    metalsmith: Metalsmith;
    cache: PreviewCache;
    cacheQueue: MapWithDefault<string, Map<string, Buffer>>;
    nowDate: number;
}): Promise<{
    previewDataList: PreviewDataType[];
    files: Metalsmith.Files;
    dateStateMap: MapWithDefault<string, FileDateStateInterface>;
}> {
    const previewDataList = (
        await Promise.all(
            targetFileList.map(async ({ filename, urlpath }) => {
                const dateState = dateStateMap.get(filename);
                const fileData = files[filename];

                setMetadata({
                    fileData,
                    files,
                    filename,
                    metalsmith,
                    metadata: {
                        published: dateState.published.date,
                        modified: dateState.modified.date,
                    },
                    options: pluginOptions,
                    nowDate,
                });

                if (
                    isEstablished(dateState) &&
                    (isAllfileModifiedEstablished(dateStateMap) ||
                        dateState.notFoundDetected)
                ) {
                    return;
                }

                const previewPageURL = joinURL(
                    deploy.deployAbsoluteURL,
                    urlpath,
                );

                const previewData = await fetchPageData({
                    filename,
                    urlpath,
                    previewPageURL,
                    deploy,
                    cache,
                });

                if (previewData.fromCache) {
                    const { metadata } = previewData;

                    setMetadata({
                        fileData,
                        files,
                        filename,
                        metalsmith,
                        metadata: {
                            modified: dateState.modified.date,
                            ...metadata,
                        },
                        options: pluginOptions,
                        nowDate,
                    });

                    if (!dateState.published.established) {
                        dateState.published.date = metadata.published;
                        dateState.published.established = true;

                        fileMetadataLog(
                            '%s / published date is established: %s',
                            filename,
                            dateState.published.date,
                        );
                    }
                } else if (previewData.previewPageNotFound) {
                    if (!dateState.published.established) {
                        if (!dateState.modified.established) {
                            fileMetadataLog(
                                '%s / published date and modified date is established: %s / %s',
                                filename,
                                dateState.published.date,
                                dateState.modified.date,
                            );
                        } else {
                            fileMetadataLog(
                                '%s / published date is established: %s',
                                filename,
                                dateState.published.date,
                            );
                        }
                    }

                    dateState.published.established = true;
                    dateState.modified.established = true;
                    dateState.notFoundDetected = true;
                } else {
                    const { metadata, previewPageResponse } = previewData;

                    for (const url of new Set([
                        previewPageURL,
                        ...previewPageResponse.fetchedURLs,
                    ])) {
                        cacheQueue
                            .get(filename)
                            .set(
                                url,
                                toBuffer(await previewPageResponse.getBody()),
                            );
                        previewCacheLog('enqueue to queue / %s', url);
                    }

                    setMetadata({
                        fileData,
                        files,
                        filename,
                        metalsmith,
                        metadata,
                        options: pluginOptions,
                        nowDate,
                    });

                    if (!dateState.published.established) {
                        dateState.published.date = publishedDate(deploy);
                    }
                }

                return previewData;
            }),
        )
    ).filter(isNotVoid);

    return {
        previewDataList,
        files,
        dateStateMap,
    };
}

export async function getProcessedFiles({
    previewDataList,
    files,
    // filesState,
    // dateStateMap,
    deploy,
    pluginOptions,
    metalsmith,
}: {
    previewDataList: PreviewDataType[];
    files: Metalsmith.Files;
    filesState: ObjectState<Metalsmith.Files>;
    dateStateMap: MapWithDefault<string, FileDateStateInterface>;
    deploy: NetlifyDeployData;
    pluginOptions: OptionsInterface;
    metalsmith: Metalsmith;
}): Promise<Metalsmith.Files> {
    for (const previewData of previewDataList) {
        if (previewData.contents) {
            const filename = previewData.filename;
            const fileData = files[filename];
            const deployedPageMetadata = {
                deploy,
                ...(previewData.fromCache
                    ? pickProps(previewData, [
                          'previewPageResponse',
                          'cachedResponse',
                      ])
                    : pickProps(previewData, [
                          'previewPageResponse',
                          'cachedResponse',
                      ])),
            };
            const generatingPageMetadata = {
                files,
                filename,
                fileData,
                metalsmith,
            };

            await pluginOptions.metadataUpdater(
                previewData.contents,
                fileData,
                {
                    ...deployedPageMetadata,
                    ...generatingPageMetadata,
                    previewURL: previewData.previewPageURL,
                },
            );
        }
    }

    // const diff = filesState.diff();
    // processLog(
    //     'convert with the following metadata by files: %o',
    //     [...dateStateMap].reduce<Metalsmith.Files>(
    //         (dataMap, [filename, metadata]) => {
    //             const filedata = files[filename];
    //             if (filedata && !dataMap[filename]) {
    //                 dataMap[filename] = {};
    //                 Object.keys(metadata).forEach(prop => {
    //                     if (hasProp(filedata, prop)) {
    //                         dataMap[filename][prop] = filedata[prop];
    //                     }
    //                 });
    //             }
    //             return dataMap;
    //         },
    //         diff ? diff.addedOrUpdated : {},
    //     ),
    // );

    const processedFiles = await processFiles(
        metalsmith,
        files,
        pluginOptions.plugins,
    );
    processLog(
        'generated a files to compare to the preview pages of %s',
        deploy.deployAbsoluteURL,
    );

    return processedFiles;
}

export async function comparePages({
    previewDataList,
    processedFiles,
    dateStateMap,
    deploy,
    pluginOptions,
    metalsmith,
}: {
    previewDataList: PreviewDataType[];
    processedFiles: Metalsmith.Files;
    dateStateMap: MapWithDefault<string, FileDateStateInterface>;
    deploy: NetlifyDeployData;
    pluginOptions: OptionsInterface;
    metalsmith: Metalsmith;
}): Promise<{
    dateStateMap: MapWithDefault<string, FileDateStateInterface>;
}> {
    await Promise.all(
        previewDataList.map(async previewData => {
            if (previewData.previewPageNotFound) {
                return;
            }

            const { filename: beforeFilename, previewPageURL } = previewData;
            const dateState = dateStateMap.get(beforeFilename);

            if (dateState.modified.established) {
                return;
            }

            // TODO: Make it user-definable
            const processedFilename = previewPageURL2filename(
                previewPageURL,
                Object.keys(processedFiles),
                metalsmith.path(metalsmith.destination()),
            );
            if (typeof processedFilename !== 'string') {
                fileLog(
                    '%s / contents was not generated. The generated file corresponding to the URL cannot be found: %s',
                    beforeFilename,
                    previewPageURL,
                );

                // TODO: Processing when generated file corresponding to URL does not exist
                throw new Error(
                    `${beforeFilename} / contents was not generated. The generated file corresponding to the URL cannot be found: ${previewPageURL} -> undefined`,
                );
            }

            const fileData: unknown = processedFiles[processedFilename];
            if (!isFile(fileData)) {
                fileLog(
                    '%s / contents was not generated. The content of the file corresponding to the URL was not generated: %o',
                    beforeFilename,
                    { previewPageURL, processedFilename },
                );

                // TODO: Processing when the content of the file corresponding to the URL is not generated
                throw new Error(
                    `${beforeFilename} / contents was not generated. The content of the file corresponding to the URL was not generated: ${previewPageURL} -> ${processedFilename}`,
                );
            }

            const previewPageContents = await pluginOptions.contentsConverter(
                previewData.contents,
                {
                    deploy,
                    ...(previewData.fromCache
                        ? pickProps(previewData, [
                              'previewPageResponse',
                              'cachedResponse',
                          ])
                        : pickProps(previewData, [
                              'previewPageResponse',
                              'cachedResponse',
                          ])),
                },
            );
            const fileContents = await pluginOptions.contentsConverter(
                fileData.contents,
                {
                    files: processedFiles,
                    filename: processedFilename,
                    fileData,
                    metalsmith,
                },
            );

            if (
                await pluginOptions.contentsEquals({
                    file: fileContents,
                    previewPage: previewPageContents,
                    metadata: {
                        deploy,
                        ...(previewData.fromCache
                            ? pickProps(previewData, [
                                  'previewPageResponse',
                                  'cachedResponse',
                              ])
                            : pickProps(previewData, [
                                  'previewPageResponse',
                                  'cachedResponse',
                              ])),
                        files: processedFiles,
                        filename: processedFilename,
                        fileData,
                        metalsmith,
                    },
                })
            ) {
                fileCompareLog(
                    '%s / matched the content of preview %s',
                    beforeFilename,
                    previewPageURL,
                );

                dateState.modified.date = publishedDate(deploy);
            } else {
                fileCompareLog(
                    '%s / did not match the content of preview %s',
                    beforeFilename,
                    previewPageURL,
                );

                dateState.modified.established = true;
                fileMetadataLog(
                    '%s / modified date is established: %s',
                    beforeFilename,
                    dateState.modified.date,
                );
            }
        }),
    );
    return { dateStateMap };
}

export default async function({
    targetFileList,
    options: pluginOptions,
    metalsmith,
    files,
    nowDate,
}: {
    targetFileList: readonly { filename: string; urlpath: string }[];
    options: OptionsInterface;
    metalsmith: Metalsmith;
    files: Metalsmith.Files;
    nowDate: number;
}): Promise<Map<string, FileMetadataInterface>> {
    /**
     * @see https://github.com/sounisi5011/sounisi5011.jp/issues/39#issuecomment-508548319
     */

    const cache = new PreviewCache(pluginOptions.cacheDir);
    const cacheQueue = new MapWithDefault<string, Map<string, Buffer>>(
        () => new Map(),
    );
    const filesState = new ObjectState(files);
    const dateStateMap = new MapWithDefault<string, FileDateStateInterface>(
        () => ({
            published: new DateState(),
            modified: new DateState(),
            notFoundDetected: false,
        }),
    );

    for await (const deploy of getDeployList(pluginOptions)) {
        const {
            previewDataList,
            files: updatedFiles,
            dateStateMap: previewUpdatedDateStateMap,
        } = await getPreviewDataList({
            targetFileList,
            files,
            dateStateMap,
            deploy,
            pluginOptions,
            metalsmith,
            cache,
            cacheQueue,
            nowDate,
        });

        let updatedDateStateMap: typeof dateStateMap;

        if (isAllfileModifiedEstablished(previewUpdatedDateStateMap)) {
            updatedDateStateMap = previewUpdatedDateStateMap;
        } else {
            const processedFiles = await getProcessedFiles({
                previewDataList,
                files: updatedFiles,
                filesState,
                dateStateMap: previewUpdatedDateStateMap,
                deploy,
                pluginOptions,
                metalsmith,
            });

            const {
                dateStateMap: compareUpdatedDateStateMap,
            } = await comparePages({
                previewDataList,
                processedFiles,
                dateStateMap: previewUpdatedDateStateMap,
                deploy,
                pluginOptions,
                metalsmith,
            });

            updatedDateStateMap = compareUpdatedDateStateMap;
        }

        if (isAllfileEstablished(updatedDateStateMap)) {
            break;
        }

        filesState.rollback();
    }

    filesState.rollback();

    cacheQueue.forEach((cacheQueue, filename) => {
        const dateState = dateStateMap.get(filename);
        const published = dateState.published.date;
        if (published) {
            cacheQueue.forEach((body, previewPageURL) => {
                cache.set(previewPageURL, {
                    body,
                    published,
                });
                previewCacheLog('stored in cache / %s', previewPageURL);
            });
        }
    });

    cache.save();
    previewCacheLog('saved cache');

    return [...dateStateMap.entries()].reduce((map, [filename, dateState]) => {
        map.set(filename, {
            published: dateState.published.date,
            modified: dateState.modified.date,
        });

        if (!dateState.modified.established) {
            if (!dateState.published.established) {
                fileMetadataLog(
                    '%s / published date and modified date is established: %s / %s',
                    filename,
                    dateState.published.date,
                    dateState.modified.date,
                );
            } else {
                fileMetadataLog(
                    '%s / published date is established: %s',
                    filename,
                    dateState.published.date,
                );
            }
        }

        return map;
    }, new Map<string, FileMetadataInterface>());
}
