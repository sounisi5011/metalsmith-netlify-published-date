import { value2str } from '../utils';

export function voidReturnFunc(
    func: Function,
): (...args: readonly unknown[]) => Promise<void> {
    return async (...args) => {
        await func(...args);
    };
}

export function strReturnFunc(
    func: Function,
    errmsg: string,
): (...args: readonly unknown[]) => Promise<string> {
    return async (...args) => {
        const retval: unknown = await func(...args);
        if (typeof retval !== 'string') {
            throw new TypeError(`${errmsg}: ${value2str(retval)}`);
        }
        return retval;
    };
}

export function typesafeFunc<T>(
    func: Function,
    returnTypeGuard: (value: unknown) => value is T,
    errmsg: string,
): (...args: readonly unknown[]) => Promise<T> {
    return async (...args) => {
        const retval: unknown = await func(...args);
        if (!returnTypeGuard(retval)) {
            throw new TypeError(`${errmsg}: ${value2str(retval)}`);
        }
        return retval;
    };
}
