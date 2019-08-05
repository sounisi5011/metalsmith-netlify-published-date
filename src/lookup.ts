import got from 'got';
import Metalsmith from 'metalsmith';

import PreviewCache, { CachedPreviewResponseInterface } from './cache/preview';
import { getFirstParentCommits } from './git';
import { NetlifyDeployData, netlifyDeploys } from './netlify';
import { OptionsInterface, setMetadata } from './plugin';
import { isNotVoid, joinURL, MapWithDefault, pickProps } from './utils';
import { debug } from './utils/log';
import { isFile, processFiles } from './utils/metalsmith';
import createState from './utils/obj-restore';

const log = debug.extend('lookup');
const fileLog = log.extend('file');
const previewLog = log.extend('netlify-preview');

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
    previewPageResponse: got.Response<Buffer> | null;
    cachedResponse: CachedPreviewResponseInterface | null;
    previewPageNotFound: boolean;
    fromCache: boolean;
}

export interface PreviewDataInterface extends PreviewBaseDataInterface {
    metadata: { published: string; modified: string };
    contents: Buffer;
    previewPageResponse: got.Response<Buffer>;
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

export async function getDeployList({
    siteID,
    accessToken,
}: {
    siteID: string;
    accessToken: string | null;
}): ReturnType<typeof netlifyDeploys> {
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
        const response = await got(url, { encoding: null });
        previewLog('%s / fetchd', url);
        return response;
    } catch (error) {
        if (error instanceof got.HTTPError) {
            previewLog('%s / fetchd', url);
            if (error.statusCode === 404) {
                return null;
            }
        }
        throw error;
    }
}

export async function fetchPageData({
    filename,
    urlpath,
    previewPageURL,
    deploy,
    pluginOptions,
    cache,
}: {
    filename: string;
    urlpath: string;
    previewPageURL: string;
    deploy: NetlifyDeployData;
    pluginOptions: OptionsInterface;
    cache: PreviewCache;
}): Promise<PreviewDataType> {
    const cachedResponse = cache.get(previewPageURL);
    if (cachedResponse) {
        previewLog('fetch from cache / %s', previewPageURL);

        const contents = await pluginOptions.contentsConverter(
            cachedResponse.body,
            { deploy, previewPageResponse: null, cachedResponse },
        );

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

    try {
        const previewPageResponse = await got(previewPageURL, {
            encoding: null,
        });
        previewLog('fetch is successful / %s', previewPageURL);

        const published = publishedDate(deploy);
        const modified = publishedDate(deploy);
        const contents = await pluginOptions.contentsConverter(
            previewPageResponse.body,
            { deploy, previewPageResponse, cachedResponse: null },
        );

        const ret: PreviewDataInterface = {
            filename,
            urlpath,
            previewPageURL,
            previewPageResponse,
            cachedResponse: null,
            contents,
            metadata: { published, modified },
            previewPageNotFound: false,
            fromCache: false,
        };
        return ret;
    } catch (error) {
        if (error instanceof got.HTTPError) {
            previewLog(
                'fetch fails with HTTP %s %s / %s',
                error.statusCode,
                error.statusMessage,
                previewPageURL,
            );

            if (error.statusCode === 404) {
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
            }
        }
        throw error;
    }
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
    const previewDataList = (await Promise.all(
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

            if (isEstablished(dateState)) {
                return;
            }

            const previewPageURL = joinURL(deploy.deployAbsoluteURL, urlpath);

            const previewData = await fetchPageData({
                filename,
                urlpath,
                previewPageURL,
                deploy,
                pluginOptions,
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

                dateState.published.date = metadata.published;
                dateState.published.established = true;
            } else if (previewData.previewPageNotFound) {
                if (!dateState.published.established) {
                    fileLog(
                        !dateState.modified.established
                            ? '%s / published date and modified date is established: %s / %s'
                            : '%s / published date is established: %s',
                        filename,
                        dateState.published.date,
                        dateState.modified.date,
                    );
                }

                dateState.published.established = true;
                dateState.modified.established = true;
            } else {
                const { metadata, previewPageResponse } = previewData;

                new Set([
                    previewPageURL,
                    previewPageResponse.requestUrl,
                    ...(previewPageResponse.redirectUrls || []),
                    previewPageResponse.url,
                ]).forEach(previewPageURL => {
                    cacheQueue
                        .get(filename)
                        .set(previewPageURL, previewPageResponse.body);
                });
                previewLog('%s / enqueue to queue for cache', previewPageURL);

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
    )).filter(isNotVoid);

    return {
        previewDataList,
        files,
        dateStateMap,
    };
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

            const {
                filename,
                previewPageURL,
                contents: previewPageContents,
                metadata,
            } = previewData;
            const dateState = dateStateMap.get(filename);
            const fileData: unknown = processedFiles[filename];

            if (dateState.modified.established) {
                return;
            }

            if (!isFile(fileData)) {
                fileLog(
                    '%s / contents was not generated. used metadata: %o',
                    filename,
                    {
                        ...metadata,
                        published: new Date(metadata.published),
                        modified: new Date(
                            previewData.fromCache
                                ? publishedDate(deploy)
                                : previewData.metadata.modified,
                        ),
                    },
                );
                // TODO: processedFilesに対象のファイルのコンテンツが存在しなかった場合の処理
                return;
            }

            const fileContents = await pluginOptions.contentsConverter(
                fileData.contents,
                {
                    files: processedFiles,
                    filename,
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
                        filename,
                        fileData,
                        metalsmith,
                    },
                })
            ) {
                fileLog(
                    '%s / matched the content of preview %s',
                    filename,
                    previewPageURL,
                );

                dateState.modified.date = publishedDate(deploy);
            } else {
                fileLog(
                    '%s / did not match the content of preview %s',
                    filename,
                    previewPageURL,
                );

                dateState.modified.established = true;
                fileLog(
                    '%s / modified date is established: %s',
                    filename,
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
    const filesState = createState(files);
    const dateStateMap = new MapWithDefault<string, FileDateStateInterface>(
        () => ({
            published: new DateState(),
            modified: new DateState(),
        }),
    );

    for (const deploy of await getDeployList(pluginOptions)) {
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
            const processedFiles = await processFiles(
                metalsmith,
                updatedFiles,
                pluginOptions.plugins,
            );
            log(
                'generated a files to compare to the preview pages / %s',
                deploy.deployAbsoluteURL,
            );

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

        filesState.restore();
    }

    filesState.restore();

    cacheQueue.forEach((cacheQueue, filename) => {
        const dateState = dateStateMap.get(filename);
        const published = dateState.published.date;
        if (published) {
            cacheQueue.forEach((body, previewPageURL) => {
                cache.set(previewPageURL, {
                    body,
                    published,
                });
            });
        }
    });
    cache.save();

    return new Map(
        [...dateStateMap.entries()].map(([filename, dateState]) => [
            filename,
            {
                published: dateState.published.date,
                modified: dateState.modified.date,
            },
        ]),
    );
}
