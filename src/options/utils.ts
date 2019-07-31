export function strReturnFunc(
    func: Function,
    errmsg: string,
): (...args: readonly unknown[]) => Promise<string> {
    return async (...args) => {
        const retval: unknown = await func(...args);
        if (typeof retval !== 'string') {
            throw new TypeError(`${errmsg}: ${typeof retval}`);
        }
        return retval;
    };
}
