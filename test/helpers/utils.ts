import fs from 'fs';
import path from 'path';
import util from 'util';

const fsStat = util.promisify(fs.stat);
const fsReadFile = util.promisify(fs.readFile);

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

export function addSlash(path: string): string {
    return path.startsWith('/') ? path : `/${path}`;
}

/**
 * @see https://qiita.com/muddydixon/items/2edf6dcb84295eccf4f3
 */
export function isValidDate(date: Date): boolean {
    return !Number.isNaN(date.getTime());
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

export async function readFile(...paths: string[]): Promise<string> {
    return fsReadFile(path.resolve(...paths), 'utf8');
}
