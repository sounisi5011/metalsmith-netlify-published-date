import test from 'ava';
import parseLink from 'parse-link-header';

import { isNetlifyDeploy } from '../src/netlify';
import { redirectFetch } from '../src/utils/fetch';
import { isValidDate } from './helpers/utils';

const API_PREFIX = 'https://api.netlify.com/api/v1/';
const siteID = process.env.NETLIFY_API_SITE_ID;
const accessToken = process.env.NETLIFY_API_ACCESS_TOKEN;

const testFn = siteID ? test : test.skip;

testFn('Netlify API responses should be in a valid format', async t => {
    const fetchedURL = new Set<string>();

    /**
     * @see https://www.netlify.com/docs/api/#deploys
     */
    let url = `${API_PREFIX}sites/${siteID}/deploys`;
    while (!fetchedURL.has(url)) {
        const nextURL = await (async url => {
            const headers = accessToken
                ? { authorization: `Bearer ${accessToken}` }
                : {};
            const result = await redirectFetch(url, { headers });
            const bodyStr = (await result.getBody()).toString();
            const linkHeader = Array.isArray(result.headers.link)
                ? result.headers.link.join(', ')
                : result.headers.link;

            let body: unknown = null;
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
                            | 'published_at'
                        )[] = ['created_at', 'updated_at', 'published_at'];
                        for (const prop of props) {
                            const value = deploy[prop];
                            if (value !== null) {
                                if (!isValidDate(new Date(value))) {
                                    t.log({
                                        url,
                                        index,
                                        field: { [prop]: value },
                                    });
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

            return nextURL;
        })(url);

        if (nextURL) {
            url = nextURL;
        }
    }
});
