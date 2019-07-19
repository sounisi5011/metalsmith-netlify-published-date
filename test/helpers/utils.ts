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
