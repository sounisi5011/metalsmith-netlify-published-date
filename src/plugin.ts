import deepFreeze from 'deep-freeze-strict';
import got from 'got';
import Metalsmith from 'metalsmith';
import path from 'path';

import { CachedPreviewResponseInterface } from './cache/preview';
import lookup, { PreviewDataType } from './lookup';
import { NetlifyDeployData } from './netlify';
import { normalizeOptions } from './options';
import { isNotVoid, path2url } from './utils';
import { debug as log } from './utils/log';
import {
    createPlugin,
    createPluginGenerator,
    FileInterface,
    getMatchedFiles,
    isFile,
    processFiles,
} from './utils/metalsmith';
import { DeepReadonly } from './utils/types';

const fileLog = log.extend('file');
const fileValidationLog = fileLog.extend('validation');
const filePreviewURLLog = fileLog.extend('preview-url');

/*
 * Interfaces
 */

export type OptionsInterface = DeepReadonly<WritableOptionsInterface>;

export interface WritableOptionsInterface {
    pattern: string | string[];
    siteID: string;
    accessToken: string | null;
    cacheDir: string | null;
    plugins: Metalsmith.Plugin[];
    defaultDate:
        | ((metadata: GeneratingPageMetadataInterface) => unknown)
        | Date
        | null;
    filename2urlPath(
        filename: string,
        metadata: Omit<GeneratingPageMetadataInterface, 'filename'>,
    ): string | Promise<string>;
    metadataUpdater(
        previewContents: Buffer,
        filedata: Metalsmith.Files[keyof Metalsmith.Files],
        metadata: DeployedPageMetadataInterface &
            GeneratingPageMetadataInterface &
            PreviewDataType,
    ): void | Promise<void>;
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

export function publishedDate(deploy: NetlifyDeployData): string {
    return deploy.published_at || deploy.created_at;
}

export async function getTargetFileList({
    options,
    files,
    metalsmith,
}: {
    options: OptionsInterface;
    files: Metalsmith.Files;
    metalsmith: Metalsmith;
}): Promise<{ filename: string; urlpath: string }[]> {
    const matchedFiles = getMatchedFiles(files, options.pattern);
    const targetFileList = (await Promise.all(
        matchedFiles.map(async filename => {
            const fileData = files[filename];

            fileValidationLog('checking file: %s', filename);
            if (!isFile(fileData)) {
                return;
            }

            const urlpath = path2url(
                await options.filename2urlPath(filename, {
                    files,
                    fileData,
                    metalsmith,
                }),
            );
            filePreviewURLLog('get URL Path: %o -> %o', filename, urlpath);

            return { filename, urlpath };
        }),
    )).filter(isNotVoid);
    return targetFileList;
}

export function setMetadata({
    fileData,
    files,
    filename,
    metalsmith,
    metadata,
    options,
    nowDate,
}: {
    fileData: FileInterface;
    files: Metalsmith.Files;
    filename: string;
    metalsmith: Metalsmith;
    metadata: { published: string | null; modified: string | null };
    options: OptionsInterface;
    nowDate: number;
}): { fileData: FileInterface } {
    fileData.published = defaultDate2value({
        dateStr: metadata.published,
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
        dateStr: metadata.modified,
        defaultDate: options.defaultDate,
        nowDate,
        metadata: {
            files,
            filename,
            fileData,
            metalsmith,
        },
    });
    return { fileData };
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
    plugins: [],
    defaultDate: null,
    filename2urlPath: filename => filename,
    contentsConverter: contents => contents,
    metadataUpdater: () => {},
    contentsEquals: ({ file, previewPage }) => file.equals(previewPage),
});

/*
 * Main function
 */

export default createPluginGenerator((opts = {}) => {
    log('initialize plugin');

    const options = normalizeOptions(opts, defaultOptions);

    return createPlugin(async (files, metalsmith) => {
        log('start plugin processing');

        const nowDate = Date.now();
        const targetFileList = await getTargetFileList({
            options,
            files,
            metalsmith,
        });
        if (targetFileList.length >= 1) {
            log(
                'start lookup of published date and modified date in this files: %o',
                targetFileList.reduce<Record<string, { urlpath: string }>>(
                    (obj, { filename, urlpath }) => {
                        obj[filename] = { urlpath };
                        return obj;
                    },
                    {},
                ),
            );

            const metaMap = await lookup({
                targetFileList,
                options,
                metalsmith,
                files,
                nowDate,
            });

            metaMap.forEach((metadata, filename) => {
                setMetadata({
                    fileData: files[filename],
                    files,
                    filename,
                    metalsmith,
                    metadata,
                    options,
                    nowDate,
                });
            });

            log(
                'convert with the following metadata by files: %o',
                [...metaMap].reduce<Metalsmith.Files>(
                    (dataMap, [filename, metadata]) => {
                        dataMap[filename] = {};
                        Object.keys(metadata).forEach(prop => {
                            dataMap[filename][prop] = files[filename][prop];
                        });
                        return dataMap;
                    },
                    {},
                ),
            );

            await processFiles(metalsmith, files, options.plugins);
        }

        log('complete plugin processing');
    });
}, defaultOptions);
