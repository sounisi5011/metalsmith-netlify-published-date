import escapeRegExp from 'escape-string-regexp';
import fs from 'fs';
import path from 'path';
import util from 'util';

const fsStat = util.promisify(fs.stat);

export function hasProp(
    value: unknown,
    props: readonly Parameters<typeof Object.prototype.hasOwnProperty>[0][],
): boolean {
    return props.some(prop =>
        Object.prototype.hasOwnProperty.call(value, prop),
    );
}

export function deleteProps<T extends Record<U, unknown>, U extends string>(
    { ...obj }: T,
    props: readonly U[],
): Omit<T, U> {
    props.forEach(prop => {
        delete obj[prop];
    });
    return obj;
}

export function entries2obj<T>(
    entries: readonly (readonly [string, T])[],
): { [s: string]: T } {
    return entries.reduce<{ [s: string]: T }>((obj, [prop, value]) => {
        obj[prop] = value;
        return obj;
    }, {});
}

/**
 * @see https://qiita.com/muddydixon/items/2edf6dcb84295eccf4f3
 */

export function isValidDate(date: Date): boolean {
    return !Number.isNaN(date.getTime());
}

export function addSlash(path: string): string {
    return path.startsWith('/') ? path : `/${path}`;
}

export async function chdir(
    dirpath: string | string[],
    callback: () => void | Promise<void>,
): Promise<void> {
    const cwd = process.cwd();

    process.chdir(Array.isArray(dirpath) ? path.resolve(...dirpath) : dirpath);

    await callback();

    process.chdir(cwd);
}

export async function fileExists(...paths: string[]): Promise<boolean> {
    try {
        await fsStat(path.resolve(...paths));
        return true;
    } catch (err) {
        if (err.code === 'ENOENT') {
            return false;
        }
        throw err;
    }
}

export function inspectSingleLine(
    value: unknown,
    inspectOptions: util.InspectOptions = {},
): string {
    return util.inspect(value, { ...inspectOptions, breakLength: Infinity });
}

export function appendValueReportPattern(
    pattern: RegExp,
    value: unknown,
    inspectOptions: util.InspectOptions = {},
): RegExp {
    const origPattern = pattern.source.replace(/\$$/, '');
    const escapedValue = escapeRegExp(inspectSingleLine(value, inspectOptions));
    return new RegExp(`${origPattern}( .+)?: ${escapedValue}$`, pattern.flags);
}
