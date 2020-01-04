import test from 'ava';
import parseLink from 'parse-link-header';

import { isNetlifyDeploy } from '../src/netlify';
import { redirectFetch } from '../src/utils/fetch';
import { isValidDate, replaceAll } from './helpers/utils';

const API_PREFIX = 'https://api.netlify.com/api/v1/';
const siteID = process.env.NETLIFY_API_SITE_ID;
const accessToken = process.env.NETLIFY_API_ACCESS_TOKEN;

const privateEnvsReplacer = replaceAll(
    [accessToken, `\${NETLIFY_API_ACCESS_TOKEN}`],
    [siteID, `\${NETLIFY_API_SITE_ID}`],
);

const testFn = siteID ? test : test.skip;

testFn('Netlify API responses should be in a valid format', async t => {
    const fetchedURL = new Set<string>();

    if (accessToken) {
        t.log({ accessToken: '*'.repeat(accessToken.length) });
    }

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
            t.log('HTTP', result.statusCode, result.statusMessage);
            t.log(privateEnvsReplacer(result.fetchedURLs.join('\n→ ')));
            t.log(
                new Map(
                    Object.entries(result.headers).map(([key, value]) => {
                        if (typeof value === 'string') {
                            value = privateEnvsReplacer(value);
                        } else if (value) {
                            value = value.map(privateEnvsReplacer);
                        }
                        return [key, value];
                    }),
                ),
            );

            const bodyStr = (await result.getBody()).toString();
            const linkHeader = Array.isArray(result.headers.link)
                ? result.headers.link.join(', ')
                : result.headers.link;

            let body: unknown = null;
            t.notThrows(() => {
                try {
                    body = JSON.parse(bodyStr);
                } catch (error) {
                    t.log({
                        url: privateEnvsReplacer(url),
                        bodyStr: privateEnvsReplacer(bodyStr),
                    });
                    throw error;
                }
            }, `response body should be valid JSON: ${privateEnvsReplacer(url)}`);

            fetchedURL.add(url);

            if (!Array.isArray(body)) {
                t.log({ url: privateEnvsReplacer(url), body });
                t.fail(
                    `response body should be array: ${privateEnvsReplacer(
                        url,
                    )}`,
                );
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
                                        url: privateEnvsReplacer(url),
                                        index,
                                        field: {
                                            [prop]: privateEnvsReplacer(value),
                                        },
                                    });
                                    t.fail(
                                        `${prop} field of deploy data of index number ${index} should be parsable date format: ${privateEnvsReplacer(
                                            url,
                                        )}`,
                                    );
                                }
                            }
                        }
                    } else {
                        t.log({ url: privateEnvsReplacer(url), index, deploy });
                        t.fail(
                            `value of index number ${index} in the response body should be a valid deploy data: ${privateEnvsReplacer(
                                url,
                            )}`,
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
