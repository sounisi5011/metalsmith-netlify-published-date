import path from 'path';
import util from 'util';

export function isNotVoid<T>(value: T | undefined | void): value is T {
    return value !== undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isObject(value: unknown): value is Record<any, unknown> {
    return typeof value === 'object' && value !== null;
}

export function isStringArray(
    value: ReadonlyArray<unknown>,
): value is string[] {
    return value.every(v => typeof v === 'string');
}

export function hasProp<
    T extends object,
    U extends Parameters<typeof Object.prototype.hasOwnProperty>[0]
>(value: T, prop: U): value is typeof value & { [P in U]: unknown } {
    return Object.prototype.hasOwnProperty.call(value, prop);
}

export function getPropertyNames<T>(...values: T[]): (keyof T)[] {
    return [
        ...new Set(
            ([] as (keyof T)[]).concat(
                ...values.map(
                    value => Object.getOwnPropertyNames(value) as (keyof T)[],
                ),
            ),
        ),
    ];
}

/**
 * @see https://github.com/lodash/lodash/blob/f8c7064d450cc068144c4dad1d63535cba25ae6d/.internal/getAllKeys.js
 */
export function getAllProps<T extends object>(value: T): (keyof T)[] {
    const symbolProps = Object.getOwnPropertySymbols(value).filter(symbol =>
        Object.prototype.propertyIsEnumerable.call(value, symbol),
    );
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore: TS2322 -- Type '(string | symbol)[]' is not assignable to type '(keyof T)[]'.
    return [...Object.keys(value), ...symbolProps];
}

export function getPropertyDescriptor<O, P extends keyof O>(
    value: O,
    prop: P,
): TypedPropertyDescriptor<O[P]> | undefined {
    return Object.getOwnPropertyDescriptor(value, prop);
}

export function getPropertyDescriptorEntries<T extends object>(
    value: T,
): [keyof T, TypedPropertyDescriptor<T[keyof T]>][] {
    const descs = Object.getOwnPropertyDescriptors(value);
    const props = [
        ...(Object.getOwnPropertyNames(descs) as (keyof T)[]),
        ...(Object.getOwnPropertySymbols(descs) as (keyof T)[]),
    ];
    return props.map(prop => [prop, descs[prop]]);
}

export function pickProps<T extends object, U extends keyof T>(
    obj: T,
    props: readonly U[],
): Pick<T, U> {
    const desc = Object.getOwnPropertyDescriptors(obj);
    getAllProps(desc).forEach(prop => {
        if (!props.includes(prop as U)) {
            delete desc[prop];
        }
    });
    return Object.defineProperties({}, desc);
}

export function freezeProperty(obj: object, prop: string): void {
    Object.defineProperty(obj, prop, { configurable: false, writable: false });
}

export function initObject<O = unknown>(
    obj: O,
    origObj: object,
    propertiesObj: object | null = origObj,
): O {
    Object.setPrototypeOf(obj, Object.getPrototypeOf(origObj));
    if (propertiesObj) {
        Object.defineProperties(
            obj,
            Object.getOwnPropertyDescriptors(propertiesObj),
        );
    }
    return obj;
}

export function equalsMap<K = unknown, V = unknown>(
    map1: Map<K, V> | readonly (readonly [K, V])[],
    map2: Map<K, V>,
): boolean {
    const map1arr = [...map1];
    return (
        map1arr.length === map2.size &&
        map1arr.every(
            ([key, value]) => map2.has(key) && map2.get(key) === value,
        )
    );
}

export function equalsSet<V = unknown>(
    set1: Set<V> | readonly V[],
    set2: Set<V>,
): boolean {
    const set1arr = [...set1];
    return (
        set1arr.length === set2.size && set1arr.every(value => set2.has(value))
    );
}

export function map2obj<K extends PropertyKey, V = unknown>(
    map: Map<K, V>,
): Record<K, V> {
    return [...map].reduce(
        (obj, [key, value]) => Object.assign(obj, { [key]: value }),
        {} as Record<K, V>,
    );
}

export function value2str(
    value: unknown,
    options: Pick<util.InspectOptions, 'depth' | 'maxArrayLength'> = {},
): string {
    return util.inspect(value, { depth: 1, ...options, breakLength: Infinity });
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

export function url2path(urlpath: string): string {
    return urlpath
        .split('/')
        .map(decodeURIComponent)
        .join(path.sep);
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

export function toBuffer(value: string | Buffer): Buffer {
    if (Buffer.isBuffer(value)) {
        return value;
    } else {
        return Buffer.from(value);
    }
}
