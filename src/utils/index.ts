import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isObject(value: unknown): value is Record<any, unknown> {
    return typeof value === 'object' && value !== null;
}

export function isStringArray(value: unknown[]): value is string[] {
    return value.every(v => typeof v === 'string');
}

export function hasProp<
    T extends object,
    U extends (Parameters<typeof Object.prototype.hasOwnProperty>)[0]
>(value: T, prop: U): value is (typeof value) & { [P in U]: unknown } {
    return Object.prototype.hasOwnProperty.call(value, prop);
}

export function freezeProperty(obj: object, prop: string): void {
    Object.defineProperty(obj, prop, { configurable: false, writable: false });
}

export function rfc3986EncodeURIComponent(uriComponent: string): string {
    return encodeURIComponent(uriComponent).replace(
        /[!'()*]/g,
        char =>
            '%' +
            char
                .charCodeAt(0)
                .toString(16)
                .toUpperCase(),
    );
}

export function joinURL(rootURL: string, urlPath: string): string {
    if (urlPath === '') {
        return rootURL;
    }
    return rootURL.replace(/\/*$/, '/') + urlPath.replace(/^\/*/, '');
}

export function path2url(pathstr: string): string {
    return pathstr
        .split(path.sep === '\\' ? /[\\/]/ : path.sep)
        .map(rfc3986EncodeURIComponent)
        .join('/');
}

export function findEqualsPath(
    baseDirpath: string,
    filepath: string,
    pathList: readonly string[],
): string | undefined {
    const absoluteFilepath = path.resolve(baseDirpath, filepath);
    return pathList.find(
        targetPath =>
            path.resolve(baseDirpath, targetPath) === absoluteFilepath,
    );
}

export function requireByCWD(
    cwd: string,
    id: string,
    errorCallback: (error: unknown) => void,
): unknown {
    try {
        const pathstr = require.resolve(id, { paths: [cwd] });
        return require(pathstr);
    } catch (error) {
        errorCallback(error);
    }
    return undefined;
}
