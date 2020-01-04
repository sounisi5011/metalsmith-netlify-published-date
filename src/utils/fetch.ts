import http from 'http';
import https from 'https';
import url from 'url';

import { isStringArray } from '.';

const WHATWG_URL = typeof URL === 'function' ? URL : url.URL;
type WHATWG_URL = URL | url.URL;

type FetchResultBody = string | Buffer;

type FetchOptions = Omit<
    https.RequestOptions,
    'protocol' | 'host' | 'hostname' | 'path'
>;

export class FetchResult {
    public readonly requestURL: string;
    public readonly requestOptions: https.RequestOptions;
    public readonly request: http.ClientRequest;
    public readonly response: http.IncomingMessage;
    private __bodyCache: FetchResultBody | null = null;
    private __chunkListCache: ReadonlyArray<
        string | Buffer | Uint8Array
    > | null = null;

    public constructor(
        requestURL: WHATWG_URL,
        requestOptions: https.RequestOptions,
        request: http.ClientRequest,
        response: http.IncomingMessage,
    ) {
        this.requestURL = requestURL.href;
        this.requestOptions = requestOptions;
        this.request = request;
        this.response = response;
        Object.defineProperties(this, {
            requestURL: { enumerable: true, writable: false },
            requestOptions: { enumerable: true, writable: false },
            request: { enumerable: true, writable: false },
            response: { enumerable: true, writable: false },
            __bodyCache: { enumerable: false, writable: true },
            __chunkListCache: { enumerable: false, writable: true },
        });
    }

    public get statusCode(): number {
        return this.response.statusCode ?? NaN;
    }

    public get statusMessage(): string {
        return this.response.statusMessage ?? '';
    }

    public get headers(): http.IncomingHttpHeaders {
        return this.response.headers;
    }

    /**
     * @see https://fetch.spec.whatwg.org/commit-snapshots/8ca61488c0c9efb32fd138ce14e25ce2b4ce0dfc/#dom-response-ok
     */
    public get isOk(): boolean {
        const { statusCode } = this;
        return statusCode >= 200 && statusCode <= 299;
    }

    /**
     * @see https://fetch.spec.whatwg.org/commit-snapshots/8ca61488c0c9efb32fd138ce14e25ce2b4ce0dfc/#redirect-status
     */
    public get isRedirect(): boolean {
        return [301, 302, 303, 307, 308].includes(this.statusCode);
    }

    public getBody(): FetchResultBody | Promise<FetchResultBody> {
        if (this.__bodyCache !== null) {
            return this.__bodyCache;
        }

        const chunkList = this.getBodyList();

        if (chunkList instanceof Promise) {
            return chunkList.then(
                chunkList =>
                    (this.__bodyCache = this.__chunkList2Body(chunkList)),
            );
        }

        return (this.__bodyCache = this.__chunkList2Body(chunkList));
    }

    public getBodyList():
        | ReadonlyArray<string | Buffer | Uint8Array>
        | Promise<ReadonlyArray<string | Buffer | Uint8Array>> {
        if (this.__chunkListCache !== null) {
            return this.__chunkListCache;
        }

        return new Promise((resolve, reject) => {
            const chunkList: (string | Buffer | Uint8Array)[] = [];
            this.response.on('data', (chunk: unknown) => {
                if (
                    typeof chunk === 'string' ||
                    Buffer.isBuffer(chunk) ||
                    chunk instanceof Uint8Array
                ) {
                    chunkList.push(chunk);
                }
            });
            this.response.on('end', () => {
                this.__chunkListCache = chunkList;
                resolve(chunkList);
            });
            this.response.on('error', error => {
                reject(error);
            });
        });
    }

    private __chunkList2Body(
        chunkList: ReadonlyArray<string | Buffer | Uint8Array>,
    ): FetchResultBody {
        if (isStringArray(chunkList)) {
            return chunkList.join('');
        }

        const bufList = chunkList.map(chunk =>
            typeof chunk === 'string' ? Buffer.from(chunk) : chunk,
        );
        return Buffer.concat(bufList);
    }
}

export class MultiFetchResult {
    private readonly __results: Map<string, FetchResult> = new Map();
    private readonly __firstResult: FetchResult;
    private __lastResult: FetchResult;

    public constructor(result: FetchResult) {
        this.__firstResult = result;
        this.__lastResult = result;
        Object.defineProperties(this, {
            __results: { enumerable: false, writable: false },
            __firstResult: { enumerable: false, writable: false },
            __lastResult: { enumerable: false, writable: true },
        });
        this.addResult(result);
    }

    /**
     * Map object that has the FetchResult object of the response obtained from the visited URLs as values, with all the visited URLs as keys.
     */
    public get results(): ReadonlyMap<string, FetchResult> {
        return this.__results;
    }

    /**
     * A FetchResult object indicating the result of the first request.
     */
    public get firstResult(): FetchResult {
        return this.__firstResult;
    }

    /**
     * A FetchResult object indicating the result of the last request.
     * If a redirected, this property indicates the response after the move.
     */
    public get lastResult(): FetchResult {
        return this.__lastResult;
    }

    /**
     * URL of the first request.
     */
    public get requestURL(): string {
        return this.firstResult.requestURL;
    }

    /**
     * Get all requested URLs.
     */
    public get fetchedURLs(): string[] {
        return [...this.results.keys()];
    }

    /**
     * Last URL after redirects.
     * If not redirected, this value is the same as the requestURL property.
     */
    public get responseURL(): string {
        return this.lastResult.requestURL;
    }

    public get requestOptions(): https.RequestOptions {
        return this.firstResult.requestOptions;
    }

    public get statusCode(): number {
        return this.lastResult.statusCode;
    }

    public get statusMessage(): string {
        return this.lastResult.statusMessage;
    }

    public get headers(): http.IncomingHttpHeaders {
        return this.lastResult.headers;
    }

    public get isOk(): boolean {
        return this.lastResult.isOk;
    }

    /**
     * If true, the redirect has completed.
     * If false, these are probably the reasons:
     * - Redirect could not be completed due to limitation of maxRedirects argument.
     * - During the redirect, function got a response requesting that redirect to visited URL.
     */
    public get redirectCompleted(): boolean {
        return !this.lastResult.isRedirect;
    }

    /**
     * If true, it is the response after moving by redirect.
     */
    public get redirected(): boolean {
        return this.results.size >= 2;
    }

    public getBody(): FetchResultBody | Promise<FetchResultBody> {
        return this.lastResult.getBody();
    }

    /**
     * @private
     */
    public addResult(result: FetchResult): void {
        this.__results.set(result.requestURL, result);
        this.__lastResult = result;
    }
}

export async function fetch(
    requestURL: string | WHATWG_URL,
    options: FetchOptions = {},
): Promise<FetchResult> {
    const requestUrlData =
        typeof requestURL === 'string'
            ? new WHATWG_URL(requestURL)
            : requestURL;
    const httpOptions: https.RequestOptions = {
        ...options,
        protocol: requestUrlData.protocol,
        host: requestUrlData.hostname,
        hostname: requestUrlData.hostname,
        path: requestUrlData.pathname + requestUrlData.search,
    };

    return new Promise((resolve, reject) => {
        const httpAdapter = /^https:$/i.test(requestUrlData.protocol)
            ? https
            : http;
        const request = httpAdapter.request(httpOptions, response => {
            resolve(
                new FetchResult(requestUrlData, httpOptions, request, response),
            );
        });
        request.on('error', error => {
            reject(error);
        });
        request.end();
    });
}

export async function redirectFetch(
    requestURL: string | WHATWG_URL,
    options: FetchOptions = {},
    /** @see https://fetch.spec.whatwg.org/commit-snapshots/8ca61488c0c9efb32fd138ce14e25ce2b4ce0dfc/#http-redirect-fetch */
    maxRedirects = 20,
): Promise<MultiFetchResult> {
    let multiResult: MultiFetchResult | undefined;
    let targetURL = requestURL;
    let overwriteOptions: FetchOptions = {};

    do {
        const result = await fetch(targetURL, {
            ...options,
            ...overwriteOptions,
        });
        if (!multiResult) {
            multiResult = new MultiFetchResult(result);
        } else {
            multiResult.addResult(result);
        }
        overwriteOptions = {};

        if (result.isRedirect) {
            const { response } = result;
            const { location } = response.headers;

            if (typeof location !== 'string') {
                break;
            }

            let nextTargetURL: WHATWG_URL;
            try {
                nextTargetURL = new WHATWG_URL(location, targetURL);
            } catch (error) {
                break;
            }

            if (multiResult.results.has(nextTargetURL.href)) {
                break;
            }

            targetURL = nextTargetURL;
            /** @see https://tools.ietf.org/html/rfc7231#section-6.4.4 */
            if (
                response.statusCode === 303 &&
                !/^(?:get|head)$/i.test(options.method ?? 'GET')
            ) {
                overwriteOptions = { method: 'GET' };
            }
            continue;
        }

        break;
    } while (multiResult.results.size - 1 < maxRedirects);

    return multiResult;
}
