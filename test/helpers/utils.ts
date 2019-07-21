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
