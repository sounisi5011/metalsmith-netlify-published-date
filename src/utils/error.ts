import { Debugger } from 'debug';

export function responseBodyErrorHandler(
    log: Debugger,
    url: string,
    error: unknown,
    {
        logFormat = 'failed to read response body / %s / %o',
        errorMessagePrefix,
    }: { logFormat?: string; errorMessagePrefix?: string } = {},
): never {
    log(logFormat, url, error);
    if (error instanceof Error) {
        error.message =
            (errorMessagePrefix ? errorMessagePrefix + ' ' : '') +
            `Failed to read response body: ${url} ; ${error.message}`;
    }
    throw error;
}
