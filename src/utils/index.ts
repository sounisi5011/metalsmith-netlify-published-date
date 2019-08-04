import path from 'path';

export function isNotVoid<T>(value: T | undefined | void): value is T {
    return value !== undefined;
}

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

/**
 * @see https://github.com/lodash/lodash/blob/f8c7064d450cc068144c4dad1d63535cba25ae6d/.internal/getAllKeys.js
 */
export function getAllProps<T extends object>(value: T): (keyof T)[] {
    const symbolProps = Object.getOwnPropertySymbols(value).filter(symbol =>
        Object.prototype.propertyIsEnumerable.call(value, symbol),
    );
    // @ts-ignore: TS2322 -- Type '(string | symbol)[]' is not assignable to type '(keyof T)[]'.
    return [...Object.keys(value), ...symbolProps];
}

export function deleteAllProp<T extends object>(value: T): T {
    getAllProps(value).forEach(prop => {
        delete value[prop];
    });
    return value;
}

export function freezeProperty(obj: object, prop: string): void {
    Object.defineProperty(obj, prop, { configurable: false, writable: false });
}

export function mapGetWithDefault<K, V>(map: {
    get(key: K): V | undefined;
    set(key: K, value: V): unknown;
}): (key: K, defaultValue: V) => V {
    return (key, defaultValue) => {
        const value = map.get(key);
        if (value !== undefined) {
            return value;
        } else {
            map.set(key, defaultValue);
            return defaultValue;
        }
    };
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

/**
 * @see https://stackoverflow.com/a/51321724/4907315
 */
export class MapWithDefault<K, V> extends Map<K, V> {
    private defaultGenerator: (key: K) => V;

    public constructor(defaultGenerator: (key: K) => V) {
        super();
        this.defaultGenerator = defaultGenerator;
    }

    public get(key: K): V {
        const value = super.get(key);
        if (value !== undefined) {
            return value;
        } else {
            const defaultValue = this.defaultGenerator(key);
            this.set(key, defaultValue);
            return defaultValue;
        }
    }
}
