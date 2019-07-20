import http from 'http';
import nock from 'nock';
import path from 'path';

import { CommitInterface, getFirstParentCommits } from '../../src/git';
import { NetlifyDeployInterface } from '../../src/netlify';
import { DeepReadonly } from '../../src/utils/types';
import {
    generatePronounceableRandStr,
    generateRandStr,
    randomChoice,
    randomChoiceList,
} from './random';
import { ArrayItemType } from './types';
import { addSlash } from './utils';

export const API_ROOT_URL = 'https://api.netlify.com/api/v1/';

export interface FixtureFilename {
    root: string;
    initial?: string;
    modified?: string;
    added?: string;
}

export interface RequestLog {
    host?: readonly string[];
    path: string;
}

export interface MockServer {
    deploys: {
        initial: NetlifyDeployInterface & Record<string, unknown>;
        modified: NetlifyDeployInterface & Record<string, unknown>;
        added: NetlifyDeployInterface & Record<string, unknown>;
    } & readonly (NetlifyDeployInterface & Record<string, unknown>)[];
    nockScope: {
        api: nock.Scope;
        previews: Map<string, nock.Scope>;
    };
    requestLogs: {
        api: DeepReadonly<RequestLog[]>;
        initial: DeepReadonly<RequestLog[]>;
        modified: DeepReadonly<RequestLog[]>;
        added: DeepReadonly<RequestLog[]>;
        previews: DeepReadonly<RequestLog[]>;
    };
    apiTotalPages: number;
}

export function getPreviewRootURL(deploy: NetlifyDeployInterface): string {
    return `https://${deploy.id}--${deploy.name}.netlify.com`;
}

export function createRequestLog(req: http.ClientRequest): RequestLog {
    const host = req.getHeader('host');
    return {
        ...(host !== undefined
            ? {
                  host: Array.isArray(host) ? host : [String(host)],
              }
            : null),
        path: req.path,
    };
}

const deployNameMap = new Map<string, string>();
const deployIdSet = new Map<string, Set<string>>();

export function createDeploy(
    siteID: string,
    commit: CommitInterface | Date = new Date(),
): NetlifyDeployInterface & Record<string, unknown> {
    const id = (() => {
        do {
            const idSet = deployIdSet.get(siteID) || new Set();
            if (!deployIdSet.has(siteID)) {
                deployIdSet.set(siteID, idSet);
            }

            const id = generateRandStr(24, 16);
            if (!idSet.has(id)) {
                return id;
            }
        } while (true);
    })();
    const name =
        deployNameMap.get(siteID) ||
        [
            generatePronounceableRandStr(8),
            generatePronounceableRandStr(8),
            generateRandStr(6, 16),
        ].join('-');
    const createdDate = !(commit instanceof Date) ? commit.authorDate : commit;
    const updatedDate = new Date(
        createdDate.getTime() + (Math.random() + 1) * 10000,
    );
    const publishedDate = new Date(
        createdDate.getTime() + (Math.random() + 1) * 10000,
    );

    if (!deployNameMap.has(siteID)) {
        deployNameMap.set(siteID, name);
    }

    /* eslint-disable @typescript-eslint/camelcase */
    return {
        id: id,
        name: name,
        url: `http://${name}.netlify.com`,
        admin_url: `https://app.netlify.com/sites/${name}`,
        deploy_url: `http://${
            commit instanceof Date ? id : 'deploy-preview-42'
        }.${name}.netlify.com`,
        deploy_ssl_url: `https://${
            commit instanceof Date ? id : 'deploy-preview-42'
        }--${name}.netlify.com`,
        created_at: createdDate.toISOString(),
        // Note: The value of "updated_at" may be greater than "created_at" or "published_at".
        //       When uploading a files and deployed, the "updated_at" of the overwritten older builds seems to change to the latest date.
        updated_at: updatedDate.toISOString(),
        // Note: When uploading a files and deployed, the value of "commit_ref" seems to be set to null.
        commit_ref: !(commit instanceof Date) ? commit.hash : null,
        // Note: When topic branch is deployed, the value of "published_at" seems to be set to null.
        published_at: randomChoice([null, publishedDate.toISOString()]) || null,
    };
    /* eslint-enable */
}

export default async function create(
    siteID: string,
    fixtureFilename?: FixtureFilename,
): Promise<MockServer> {
    const requestLogs: Record<keyof MockServer['requestLogs'], RequestLog[]> = {
        api: [],
        initial: [],
        modified: [],
        added: [],
        previews: [],
    };
    let apiTotalPages = 0;
    const commitList = await getFirstParentCommits();

    const initialCommitDeploy = createDeploy(siteID, new Date(0));
    const otherCommitDeployList = randomChoiceList(commitList, 2).map(commit =>
        createDeploy(siteID, commit),
    );
    const commitDeployList: readonly (
        | ArrayItemType<typeof otherCommitDeployList>
        | typeof initialCommitDeploy)[] = [
        ...otherCommitDeployList,
        initialCommitDeploy,
    ];

    const modifiedCommitDeploy = randomChoice(otherCommitDeployList);
    if (!modifiedCommitDeploy) {
        throw new Error(
            'Too few commits on Git. At least one commits are required.',
        );
    }
    const addedCommitDeploy =
        otherCommitDeployList.find(deploy => deploy !== modifiedCommitDeploy) ||
        modifiedCommitDeploy;

    /**
     * @see https://www.netlify.com/docs/api/#deploys
     */
    const apiScope = nock(API_ROOT_URL).persist();
    const pageList: (ArrayItemType<typeof commitDeployList> | null)[] = [
        ...commitDeployList,
    ];
    pageList.splice(pageList.length - 1, 0, null, null);
    pageList.forEach((deploy, index, self) => {
        const page = index + 1;
        const lastPage = self.length;
        const apiPath = `sites/${siteID}/deploys`;
        const headers = {
            // @see https://www.netlify.com/docs/api/#pagination
            Link: [
                page > 1
                    ? `<${API_ROOT_URL}${apiPath}?page=${page - 1}>; rel=prev`
                    : '',
                page < lastPage
                    ? `<${API_ROOT_URL}${apiPath}?page=${page + 1}>; rel=next`
                    : '',
                `<${API_ROOT_URL}${apiPath}?page=${lastPage}>; rel=last`,
            ]
                .filter(part => part !== '')
                .join(', '),
        };

        apiScope
            .get(addSlash(apiPath))
            .query(actualQueryObject =>
                Object.prototype.hasOwnProperty.call(actualQueryObject, 'page')
                    ? String(actualQueryObject.page) === String(page)
                    : page === 1,
            )
            .reply(200, deploy ? [deploy] : [], headers);

        apiTotalPages++;
    });

    apiScope.on(
        'request',
        (
            req: http.ClientRequest,
            _interceptor: nock.Interceptor,
            _body: string,
        ) => {
            requestLogs.api.push(createRequestLog(req));
        },
    );

    const previews: ([string, nock.Scope])[] = [];
    const previewState = {
        modified: false,
        added: false,
    };
    [...commitDeployList].reverse().forEach(deploy => {
        const previewRootURL = getPreviewRootURL(deploy);
        const previewScope = nock(previewRootURL).persist();
        const logKey2filenameMap = new Map<
            Exclude<keyof (typeof requestLogs), 'api' | 'previews'>,
            string
        >();

        previews.push([previewRootURL, previewScope]);

        if (deploy === modifiedCommitDeploy) {
            previewState.modified = true;
        }
        if (deploy === addedCommitDeploy) {
            previewState.added = true;
        }

        /*
         * Define files
         */
        if (fixtureFilename) {
            if (fixtureFilename.initial) {
                const initialFilename = fixtureFilename.initial;
                const urlPath = addSlash(initialFilename);
                previewScope
                    .get(urlPath)
                    .replyWithFile(
                        200,
                        path.resolve(fixtureFilename.root, initialFilename),
                    );
                logKey2filenameMap.set('initial', urlPath);
            }
            if (fixtureFilename.modified) {
                const modifiedFilename = fixtureFilename.modified;
                const urlPath = addSlash(modifiedFilename);
                const modifiedInterceptor = previewScope.get(urlPath);
                if (previewState.modified) {
                    modifiedInterceptor.replyWithFile(
                        200,
                        path.resolve(fixtureFilename.root, modifiedFilename),
                    );
                } else {
                    modifiedInterceptor.reply(200);
                }
                logKey2filenameMap.set('modified', urlPath);
            }
            if (fixtureFilename.added && previewState.added) {
                const addedFilename = fixtureFilename.added;
                const urlPath = addSlash(addedFilename);
                previewScope
                    .get(urlPath)
                    .replyWithFile(
                        200,
                        path.resolve(fixtureFilename.root, addedFilename),
                    );
                logKey2filenameMap.set('added', urlPath);
            }
        }
        previewScope.get(/(?:)/).reply(404);

        previewScope.on(
            'request',
            (
                req: http.ClientRequest,
                _interceptor: nock.Interceptor,
                _body: string,
            ) => {
                const requestLog = createRequestLog(req);

                requestLogs.previews.push(requestLog);
                logKey2filenameMap.forEach((urlpath, prop) => {
                    if (requestLog.path === urlpath) {
                        requestLogs[prop].push(requestLog);
                    }
                });
            },
        );
    });
    previews.reverse();

    return {
        deploys: Object.assign(commitDeployList, {
            initial: initialCommitDeploy,
            modified: modifiedCommitDeploy,
            added: addedCommitDeploy,
        }),
        nockScope: {
            api: apiScope,
            previews: new Map(previews),
        },
        requestLogs,
        apiTotalPages,
    };
}
