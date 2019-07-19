import got from 'got';
import parseLink from 'parse-link-header';

import { isObject } from './utils';

/**
 * @see https://github.com/netlify/open-api/blob/v0.11.4/swagger.yml#L1723-L1793
 */
export interface NetlifyDeployInterface {
    id: string;
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
            ['id', 'name', 'deploy_ssl_url', 'created_at', 'updated_at'].every(
                prop => typeof value[prop] === 'string',
            ) &&
            ['commit_ref', 'published_at'].every(
                prop => typeof value[prop] === 'string' || value[prop] === null,
            )
        );
    }
    return false;
}

export const API_PREFIX = 'https://api.netlify.com/api/v1/';

export async function netlifyDeploys(
    siteID: string,
    options: {
        accessToken?: string | null;
        commitHashList?: readonly string[];
        fetchCallback?: (
            url: string,
            headers: Record<string, string>,
        ) => Promise<{ body: unknown; linkHeader?: string }>;
    } = {},
): Promise<readonly NetlifyDeployData[]> {
    const fetch =
        options.fetchCallback ||
        (async (url, headers) => {
            const response = await got(url, {
                headers,
                json: true,
            });
            const linkHeaderValue = response.headers.link;
            return {
                body: response.body,
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
    const deployList: NetlifyDeployInterface[] = [];
    let initialDeploy: NetlifyDeployInterface | null = null;

    /**
     * @see https://www.netlify.com/docs/api/#deploys
     */
    let url = `${API_PREFIX}sites/${siteID}/deploys`;
    while (!fetchedURL.has(url)) {
        const lastURLSet = new Set<typeof lastURL>(lastURL);

        const { body, linkHeader } = await fetch(
            url,
            options.accessToken
                ? { authorization: `Bearer ${options.accessToken}` }
                : {},
        );
        fetchedURL.add(url);

        /**
         * @see https://www.netlify.com/docs/api/#pagination
         */
        let nextURL: string | null = null;
        if (linkHeader) {
            const linkData = parseLink(linkHeader);
            if (linkData) {
                const nextLink = linkData.next;
                nextURL = (nextLink && nextLink.url) || null;

                const lastLink = linkData.last;
                if (lastLink && lastLink.url) {
                    lastURL = lastLink.url;
                }
            }
        }
        lastURLSet.add(lastURL);

        if (Array.isArray(body)) {
            const netlifyDeployList = body.filter(isNetlifyDeploy);

            deployList.push(
                ...netlifyDeployList.filter(deploy => {
                    if (!commitHashSet) {
                        return true;
                    }

                    const commitHash = deploy.commit_ref;
                    if (commitHash !== null && commitHashSet.has(commitHash)) {
                        commitHashSet.delete(commitHash);
                        return true;
                    }

                    return false;
                }),
            );

            const isLastDeployList = !nextURL || lastURLSet.has(url);
            if (isLastDeployList && netlifyDeployList.length >= 1) {
                const lastDeploy =
                    netlifyDeployList[netlifyDeployList.length - 1];
                if (lastDeploy.commit_ref === null) {
                    initialDeploy = lastDeploy;
                }
            }
        }

        if (nextURL && (!commitHashSet || commitHashSet.size >= 1)) {
            url = nextURL;
        } else if (lastURL && !initialDeploy) {
            url = lastURL;
        }
    }

    return deployList
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .concat(
            initialDeploy && !deployList.includes(initialDeploy)
                ? [initialDeploy]
                : [],
        )
        .map(deploy => ({
            ...deploy,
            deployAbsoluteURL: deploy.deploy_ssl_url.replace(
                /^(https?:\/\/)(?:(?!--)[^.])+(--)([^.]+)(\.netlify\.com)\/?$/,
                (match, scheme, hyphen, name, domain) =>
                    name === deploy.name
                        ? scheme + deploy.id + hyphen + name + domain
                        : match,
            ),
        }));
}
