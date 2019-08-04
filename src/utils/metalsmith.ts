import Metalsmith from 'metalsmith';
import multimatch from 'multimatch';

import { freezeProperty, isObject } from './';
import { isReadonlyOrWritableArray } from './types';

export interface FileInterface extends Metalsmith.Files {
    contents: Buffer;
    [index: string]: unknown;
}

export function isFile(value: unknown): value is FileInterface {
    if (isObject(value)) {
        return (
            value.hasOwnProperty('contents') && Buffer.isBuffer(value.contents)
        );
    }
    return false;
}

export function addFile(
    files: Metalsmith.Files,
    filename: string,
    contents: string,
    originalData?: FileInterface,
): FileInterface {
    const newFile = {
        mode: '0644',
        ...originalData,
        contents: Buffer.from(contents, 'utf8'),
    };
    files[filename] = newFile;
    return newFile;
}

export function getMatchedFiles(
    files: Metalsmith.Files,
    pattern: string | readonly string[] | undefined,
): string[] {
    const matchPatterns = (Array.isArray as isReadonlyOrWritableArray)(pattern)
        ? [...pattern]
        : pattern;
    const filenameList = Object.keys(files);
    const matchedFiles = matchPatterns
        ? multimatch(filenameList, matchPatterns)
        : filenameList;
    return matchedFiles;
}

export async function processFiles(
    metalsmith: Metalsmith,
    files: Metalsmith.Files,
    plugins: readonly Metalsmith.Plugin[],
): Promise<Metalsmith.Files> {
    return new Promise((resolve, reject) => {
        metalsmith.run(files, [...plugins], (err, files) => {
            if (err) {
                reject(err);
            } else {
                resolve(files);
            }
        });
    });
}

export function createPlugin(
    callback: (
        files: Metalsmith.Files,
        metalsmith: Metalsmith,
    ) => Promise<void>,
): Metalsmith.Plugin {
    return (files, metalsmith, done) => {
        callback(files, metalsmith)
            .then(() => done(null, files, metalsmith))
            .catch(error => done(error, files, metalsmith));
    };
}

export function createEachPlugin(
    callback: (
        filename: string,
        files: Metalsmith.Files,
        metalsmith: Metalsmith,
    ) => void | Promise<void>,
    pattern?: string | readonly string[],
): Metalsmith.Plugin {
    return (files, metalsmith, done) => {
        const matchedFiles = getMatchedFiles(files, pattern);

        Promise.all(
            matchedFiles.map(filename => callback(filename, files, metalsmith)),
        )
            .then(() => done(null, files, metalsmith))
            .catch(error => done(error, files, metalsmith));
    };
}

export function createPluginGenerator<T>(
    func: (options?: Partial<T>) => Metalsmith.Plugin,
    defaultOptions: T,
): { (options?: Partial<T>): Metalsmith.Plugin; readonly defaultOptions: T } {
    const newFunc = Object.assign(func, { defaultOptions });
    freezeProperty(newFunc, 'defaultOptions');
    return newFunc;
}
