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
import { addSlash } from './utils';

export const API_ROOT_URL = 'https://api.netlify.com/api/v1/';

export interface FixtureFilename {
    root: string;
    initial?: string;
    modified?: string;
    added?: string;
}

export interface MockServer {
    deploys: {
        initial: NetlifyDeployInterface & Record<string, unknown>;
        modified: NetlifyDeployInterface & Record<string, unknown>;
        added: NetlifyDeployInterface & Record<string, unknown>;
    } & (NetlifyDeployInterface & Record<string, unknown>)[];
    nockScope: {
        api: nock.Scope;
        previews: Map<string, nock.Scope>;
    };
}

export function getPreviewRootURL(deploy: NetlifyDeployInterface): string {
    return `https://${deploy.id}--${deploy.name}.netlify.com`;
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
    const commitList = await getFirstParentCommits();

    const initialCommitDeploy = createDeploy(siteID, new Date(0));
    const otherCommitDeployList = randomChoiceList(commitList, 2).map(commit =>
        createDeploy(siteID, commit),
    );
    const commitDeployList = [...otherCommitDeployList, initialCommitDeploy];

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
                    ? actualQueryObject.page === page
                    : page === 1,
            )
            .reply(200, [deploy], headers);
    });

    const previews: ([string, nock.Scope])[] = [];
    const previewState = {
        modified: false,
        added: false,
    };
    [...commitDeployList].reverse().forEach(deploy => {
        const previewRootURL = getPreviewRootURL(deploy);
        const previewScope = nock(previewRootURL).persist();

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
                previewScope
                    .get(addSlash(initialFilename))
                    .replyWithFile(
                        200,
                        path.resolve(fixtureFilename.root, initialFilename),
                    );
            }
            if (fixtureFilename.modified) {
                const modifiedFilename = fixtureFilename.modified;
                const modifiedInterceptor = previewScope.get(
                    addSlash(fixtureFilename.modified),
                );
                if (previewState.modified) {
                    modifiedInterceptor.replyWithFile(
                        200,
                        path.resolve(fixtureFilename.root, modifiedFilename),
                    );
                } else {
                    modifiedInterceptor.reply(200);
                }
            }
            if (fixtureFilename.added && previewState.added) {
                const addedFilename = fixtureFilename.added;
                previewScope
                    .get(addSlash(addedFilename))
                    .replyWithFile(
                        200,
                        path.resolve(fixtureFilename.root, addedFilename),
                    );
            }
        }
        previewScope.get(/(?:)/).reply(404);
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
    };
}
