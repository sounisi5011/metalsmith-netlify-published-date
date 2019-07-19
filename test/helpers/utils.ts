export function addSlash(path: string): string {
    return path.startsWith('/') ? path : `/${path}`;
}
