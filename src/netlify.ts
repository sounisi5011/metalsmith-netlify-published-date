import './polyfills/symbol.async-iterator';

import parseLink from 'parse-link-header';

import { isObject } from './utils';
import { redirectFetch } from './utils/fetch';
import { debug } from './utils/log';

const log = debug.extend('netlify-api');
const requestLog = log.extend('request');
const responseLog = log.extend('response');
const responseHeadersLog = responseLog.extend('headers');
const responseErrorLog = responseLog.extend('error');

/**
 * @see https://github.com/netlify/open-api/blob/v0.11.4/swagger.yml#L1723-L1793
 */
export interface NetlifyDeployInterface {
    id: string;
    state: string;
    name: string;
    deploy_ssl_url: string;
    commit_ref: string | null;
    created_at: string;
    updated_at: string;
    published_at: string | null;
}

export type NetlifyDeployData = NetlifyDeployInterface & {
    deployAbsoluteURL: string;
};

export function isNetlifyDeploy(
    value: unknown,
): value is NetlifyDeployInterface {
    if (isObject(value)) {
        return (
            [
                'id',
                'state',
                'name',
                'deploy_ssl_url',
                'created_at',
                'updated_at',
            ].every(prop => typeof value[prop] === 'string') &&
            ['commit_ref', 'published_at'].every(
                prop => typeof value[prop] === 'string' || value[prop] === null,
            )
        );
    }
    return false;
}

export function addAbsoluteURL(
    deploy: NetlifyDeployInterface,
): NetlifyDeployData {
    return {
        ...deploy,
        deployAbsoluteURL: deploy.deploy_ssl_url.replace(
            /^(https?:\/\/)(?:(?!--)[^.])+(--)([^.]+)(\.netlify\.com)\/?$/,
            (match, scheme, hyphen, name, domain) =>
                name === deploy.name
                    ? scheme + deploy.id + hyphen + name + domain
                    : match,
        ),
    };
}

export const API_PREFIX = 'https://api.netlify.com/api/v1/';

export async function* netlifyDeploys(
    siteID: string,
    options: {
        accessToken?: string | null;
        commitHashList?: readonly string[];
        fetchCallback?: (
            url: string,
            headers: Partial<Record<string, string>>,
        ) => Promise<{ body: unknown; linkHeader?: string }>;
    } = {},
): AsyncIterableIterator<NetlifyDeployData> {
    const fetch =
        options.fetchCallback ||
        (async (url, headers) => {
            requestLog('GET %s / headers %o', url, headers);
            const result = await redirectFetch(url, { headers }).catch(
                error => {
                    responseErrorLog(
                        'fetch failed by http/https module error / %s / %o',
                        url,
                        error,
                    );
                    throw error;
                },
            );
            const response = result.lastResult.response;

            if (!result.isOk) {
                responseLog(
                    'fetch fails with HTTP %s %s / %s',
                    result.statusCode,
                    result.statusMessage,
                    url,
                );
                responseHeadersLog('headers of %s / %o', url, response.headers);
                throw new Error(
                    'Request to Netlify API failed. HTTP response status is: ' +
                        `${result.statusCode} ${result.statusMessage} ; ${url}`,
                );
            }
            responseLog('fetch is successful / %s', url);
            responseHeadersLog('headers of %s / %o', url, response.headers);

            let bodyText: string;
            try {
                bodyText = (await result.getBody()).toString();
            } catch (error) {
                responseErrorLog(
                    'failed to read response body / %s / %o',
                    url,
                    error,
                );
                if (error instanceof Error) {
                    error.message = `Request to Netlify API failed. Failed to read response body: ${url} ; ${error.message}`;
                }
                throw error;
            }

            let bodyData: unknown;
            try {
                bodyData = JSON.parse(bodyText);
            } catch (_) {
                responseErrorLog('invalid JSON body / %s', url);
                throw new SyntaxError(
                    `Netlify API returned invalid JSON from: ${url}`,
                );
            }

            const linkHeaderValue = response.headers.link;
            return {
                body: bodyData,
                linkHeader: Array.isArray(linkHeaderValue)
                    ? linkHeaderValue.join(', ')
                    : linkHeaderValue,
            };
        });
    const commitHashSet = options.commitHashList
        ? new Set(options.commitHashList)
        : null;
    const fetchedURL = new Set<string>();
    let lastURL: string | null = null;
    let initialDeploy: NetlifyDeployInterface | null = null;

    /**
     * @see https://www.netlify.com/docs/api/#deploys
     */
    let url = `${API_PREFIX}sites/${siteID}/deploys`;
    log('start fetching first page: %s', url);

    while (!fetchedURL.has(url)) {
        const lastURLSet = new Set<typeof lastURL>(lastURL);

        const headers = options.accessToken
            ? { authorization: `Bearer ${options.accessToken}` }
            : {};
        const { body, linkHeader } = await fetch(url, headers);
        fetchedURL.add(url);

        /**
         * @see https://www.netlify.com/docs/api/#pagination
         */
        let nextURL: string | null = null;
        if (linkHeader) {
            const linkData = parseLink(linkHeader);
            responseHeadersLog('pagination of %s / %o', url, linkData);
            if (linkData) {
                const nextLink = linkData.next;
                nextURL = (nextLink && nextLink.url) || null;

                const lastLink = linkData.last;
                if (lastLink && lastLink.url) {
                    lastURL = lastLink.url;
                }
            }
        } else {
            responseHeadersLog('"Link" header not found in headers / %s', url);
        }
        lastURLSet.add(lastURL);

        if (Array.isArray(body)) {
            const netlifyDeployList = body.filter(isNetlifyDeploy);

            const matchedDeployList = netlifyDeployList.filter(deploy => {
                if (deploy.state !== 'ready') {
                    return false;
                }

                if (!commitHashSet) {
                    return true;
                }

                const commitHash = deploy.commit_ref;
                if (commitHash !== null && commitHashSet.has(commitHash)) {
                    commitHashSet.delete(commitHash);
                    return true;
                }

                return false;
            });
            if (netlifyDeployList.length !== matchedDeployList.length) {
                responseLog(
                    'deploy list count: %d / among them, valid count: %d / %s',
                    netlifyDeployList.length,
                    matchedDeployList.length,
                    url,
                );
            } else {
                responseLog(
                    'deploy list count: %d / %s',
                    netlifyDeployList.length,
                    url,
                );
            }

            for (const deploy of matchedDeployList) {
                yield addAbsoluteURL(deploy);
            }

            const isLastDeployList = !nextURL || lastURLSet.has(url);
            if (isLastDeployList && netlifyDeployList.length >= 1) {
                const lastDeploy =
                    netlifyDeployList[netlifyDeployList.length - 1];
                if (lastDeploy.commit_ref === null) {
                    initialDeploy = lastDeploy;
                    if (!matchedDeployList.includes(initialDeploy)) {
                        responseLog(
                            'get the initial deploy from the response / %s',
                            url,
                        );
                        yield addAbsoluteURL(initialDeploy);
                    }
                }
            }
        } else {
            responseErrorLog(
                'response body is not an array: %o / %s',
                body,
                url,
            );
        }

        if (nextURL && (!commitHashSet || commitHashSet.size >= 1)) {
            log('start fetching next page: %s', nextURL);
            url = nextURL;
        } else if (lastURL && !initialDeploy) {
            log('start fetching last page: %s', lastURL);
            url = lastURL;
        }
    }
}
