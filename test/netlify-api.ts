import test from 'ava';
import got from 'got';
import parseLink from 'parse-link-header';

import { isNetlifyDeploy } from '../src/netlify';
import { isValidDate } from './helpers/utils';

const API_PREFIX = 'https://api.netlify.com/api/v1/';
const siteID = 'peaceful-shockley-c9f989.netlify.com';
const accessToken = null;

test('Netlify API responses should be in a valid format', async t => {
    const fetchedURL = new Set<string>();

    /**
     * @see https://www.netlify.com/docs/api/#deploys
     */
    let url = `${API_PREFIX}sites/${siteID}/deploys`;
    while (!fetchedURL.has(url)) {
        const headers = accessToken
            ? { authorization: `Bearer ${accessToken}` }
            : {};
        const response = await got(url, { headers });
        const bodyStr = response.body;
        const linkHeader = Array.isArray(response.headers.link)
            ? response.headers.link.join(', ')
            : response.headers.link;

        let body = null;
        t.notThrows(() => {
            try {
                body = JSON.parse(bodyStr);
            } catch (error) {
                t.log({ url, bodyStr });
                throw error;
            }
        }, `response body should be valid JSON: ${url}`);

        fetchedURL.add(url);

        if (!Array.isArray(body)) {
            t.log({ url, body });
            t.fail(`response body should be array: ${url}`);
        } else {
            for (const [index, deploy] of body.entries()) {
                if (isNetlifyDeploy(deploy)) {
                    const props: (
                        | 'created_at'
                        | 'updated_at'
                        | 'published_at')[] = [
                        'created_at',
                        'updated_at',
                        'published_at',
                    ];
                    for (const prop of props) {
                        const value = deploy[prop];
                        if (value !== null) {
                            if (!isValidDate(new Date(value))) {
                                t.log({ url, index, field: { [prop]: value } });
                                t.fail(
                                    `${prop} field of deploy data of index number ${index} should be parsable date format: ${url}`,
                                );
                            }
                        }
                    }
                } else {
                    t.log({ url, index, deploy });
                    t.fail(
                        `value of index number ${index} in the response body should be a valid deploy data: ${url}`,
                    );
                }
            }
        }

        /**
         * @see https://www.netlify.com/docs/api/#pagination
         */
        let nextURL: string | null = null;
        if (linkHeader) {
            const linkData = parseLink(linkHeader);
            if (linkData) {
                const nextLink = linkData.next;
                nextURL = (nextLink && nextLink.url) || null;
            }
        }

        if (nextURL) {
            url = nextURL;
        }
    }
});
