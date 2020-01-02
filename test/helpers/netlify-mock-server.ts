import http from 'http';
import nock from 'nock';
import path from 'path';

import { CommitInterface, getFirstParentCommits } from '../../src/git';
import { NetlifyDeployInterface } from '../../src/netlify';
import {
    generatePronounceableRandStr,
    generateRandStr,
    randomChoice,
    randomChoiceList,
} from './random';
import { ArrayItemType, Writeable } from './types';
import { addSlash } from './utils';

export const API_ROOT_URL = 'https://api.netlify.com/api/v1/';

export interface DeployFileSchema {
    readonly filepath: string;
}

export interface DeploySchema {
    readonly key?: string;
    readonly state?: string;
    readonly [urlpath: string]:
        | DeployFileSchema
        | string
        | Buffer
        | null
        | void;
}

export type NetlifyDeploy = NetlifyDeployInterface & Record<string, unknown>;

export class MockServer {
    readonly deploys: readonly NetlifyDeploy[] & {
        getByKey(key: string): NetlifyDeploy;
        getsUntilByKey(key: string): NetlifyDeploy[];
    };

    readonly nockScope: {
        readonly api: nock.Scope;
        readonly previews: ReadonlyMap<string, nock.Scope>;
    };

    readonly requestLogs: {
        readonly api: readonly RequestLog[];
        readonly previews: readonly RequestLog[] & {
            readonly [urlpath: string]: readonly RequestLog[];
        };
    };

    readonly apiTotalPages: number;

    constructor({
        commitDeployList,
        key2deployMap,
        apiScope,
        previews,
        requestLogs,
        apiTotalPages,
    }: {
        commitDeployList: readonly NetlifyDeploy[];
        key2deployMap: Map<string, NetlifyDeploy>;
        apiScope: nock.Scope;
        previews: [string, nock.Scope][];
        requestLogs: {
            api: RequestLog[];
            previews: RequestLog[] & { [urlpath: string]: RequestLog[] };
        };
        apiTotalPages: number;
    }) {
        this.deploys = Object.assign(commitDeployList, {
            getByKey(key: string) {
                const deploy = key2deployMap.get(key);
                if (!deploy) {
                    throw new Error(`Deploy key is not defined: ${key}`);
                }
                return deploy;
            },
            getsUntilByKey(key: string) {
                const deployByKey = key2deployMap.get(key);
                if (!deployByKey) {
                    throw new Error(`Deploy key is not defined: ${key}`);
                }

                const list: NetlifyDeploy[] = [];
                for (const deploy of commitDeployList) {
                    list.push(deploy);
                    if (deploy === deployByKey) {
                        break;
                    }
                }
                return list;
            },
        });
        this.nockScope = {
            api: apiScope,
            previews: new Map(previews),
        };
        this.requestLogs = requestLogs;
        this.apiTotalPages = apiTotalPages;
    }
}

export interface MockServerOptions {
    readonly root?: string;
}

export function getPreviewRootURL(deploy: NetlifyDeployInterface): string {
    return `https://${deploy.id}--${deploy.name}.netlify.com`;
}

export class RequestLog {
    readonly statusCode?: number;
    readonly host?: string[];
    readonly path: string;

    constructor(req: http.ClientRequest, interceptor: nock.Interceptor) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore: TS2339 -- Property 'statusCode' does not exist on type 'Interceptor'.
        const statusCode: unknown = interceptor.statusCode;
        const host = req.getHeader('host');

        if (typeof statusCode === 'number') {
            this.statusCode = statusCode;
        }

        if (host !== undefined) {
            this.host = Array.isArray(host) ? host : [String(host)];
        }

        this.path = req.path;
    }

    public toString(): string {
        const { statusCode, host, path } = this;
        return [
            statusCode !== undefined ? `HTTP ${statusCode} / ` : '',
            host !== undefined
                ? host.length > 1
                    ? `[ ${host.join(', ')} ] `
                    : host[0]
                : '',
            path,
        ].join('');
    }
}

const deployNameMap = new Map<string, string>();
const deployIdSet = new Set<string>();

export function createDeploy(
    siteID: string,
    commit: CommitInterface | Date = new Date(),
): NetlifyDeploy {
    const id = (() => {
        do {
            const id = generateRandStr(24, 16);
            if (!deployIdSet.has(id)) {
                deployIdSet.add(id);
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
        state: 'ready',
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

const siteIDSet = new Set<string>();

export default async function create(
    siteID: string,
    deploysSchema: readonly DeploySchema[] = [],
    options: MockServerOptions = {},
): Promise<MockServer> {
    if (siteIDSet.has(siteID)) {
        throw new Error(`This is a used site_id: ${siteID}`);
    }
    siteIDSet.add(siteID);

    const requestLogs: {
        api: RequestLog[];
        previews: RequestLog[] & { [urlpath: string]: RequestLog[] };
    } = {
        api: [],
        previews: Object.assign([]),
    };
    let apiTotalPages = 0;
    const commitList = await getFirstParentCommits();

    if (commitList.length + 1 < deploysSchema.length) {
        throw new Error(
            [
                'Too few commits on Git.',
                `At least ${deploysSchema.length - 1} commits are required.`,
            ].join(' '),
        );
    }

    const initialCommitDeploy = createDeploy(siteID, new Date(0));
    const otherCommitDeployList = randomChoiceList(
        commitList,
        deploysSchema.length - 1,
    ).map(commit => createDeploy(siteID, commit));
    const commitDeployList: readonly (
        | ArrayItemType<typeof otherCommitDeployList>
        | typeof initialCommitDeploy
    )[] = [...otherCommitDeployList, initialCommitDeploy];

    /**
     * @see https://www.netlify.com/docs/api/#deploys
     */
    const apiScope = nock(API_ROOT_URL).persist();
    commitDeployList.forEach((deploy, index, self) => {
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
            .reply(200, deploy ? () => [deploy] : [], headers);

        apiTotalPages++;
    });

    apiScope.on(
        'request',
        (
            req: http.ClientRequest,
            interceptor: nock.Interceptor,
            _body: string,
        ) => {
            requestLogs.api.push(new RequestLog(req, interceptor));
        },
    );

    const key2deployMap = new Map<string, NetlifyDeploy>();
    const previews: [string, nock.Scope][] = [];
    const previewFilesState: Writeable<DeploySchema> = {};
    [...commitDeployList].reverse().forEach((deploy, index) => {
        const deploySchema = deploysSchema[index];
        const previewRootURL = getPreviewRootURL(deploy);
        const previewScope = nock(previewRootURL).persist();
        const previewSchema = Object.assign(previewFilesState, deploySchema);

        const logPagesMap = new Map<string, string[]>();

        previews.push([previewRootURL, previewScope]);

        if (deploySchema) {
            const key = deploySchema.key;
            if (key) {
                if (key2deployMap.has(key)) {
                    throw new Error(`Deploy key is duplicated: ${key}`);
                }
                key2deployMap.set(key, deploy);
            }

            if (deploySchema.state) {
                deploy.state = deploySchema.state;
            }
        }

        /*
         * Define files
         */
        if (deploy.state === 'ready') {
            Object.entries(previewSchema)
                .filter(([prop]) => !['key', 'state'].includes(prop))
                .forEach(([filepath, filedata]) => {
                    if (filedata !== null && filedata !== undefined) {
                        const urlpathList = [addSlash(filepath)];

                        urlpathList.forEach(urlpath => {
                            const interceptor = previewScope.get(urlpath);

                            if (
                                typeof filedata === 'string' ||
                                Buffer.isBuffer(filedata)
                            ) {
                                interceptor.reply(200, filedata);
                            } else if (filedata.filepath) {
                                interceptor.replyWithFile(
                                    200,
                                    options.root
                                        ? path.join(
                                              options.root,
                                              filedata.filepath,
                                          )
                                        : filedata.filepath,
                                );
                            } else {
                                interceptor.reply(200);
                            }
                        });

                        logPagesMap.set(filepath, urlpathList);
                        requestLogs.previews[filepath] = [];
                    }
                });
        }
        previewScope.get(/(?:)/).reply(404);

        previewScope.on(
            'request',
            (
                req: http.ClientRequest,
                interceptor: nock.Interceptor,
                _body: string,
            ) => {
                const requestLog = new RequestLog(req, interceptor);
                requestLogs.previews.push(requestLog);
                logPagesMap.forEach((urlpathList, filepath) => {
                    urlpathList.forEach(urlpath => {
                        if (requestLog.path === urlpath) {
                            requestLogs.previews[filepath].push(requestLog);
                        }
                    });
                });
            },
        );
    });
    previews.reverse();

    return new MockServer({
        commitDeployList,
        key2deployMap,
        apiScope,
        previews,
        requestLogs,
        apiTotalPages,
    });
}
