import test from 'ava';
import path from 'path';

import exec from './helpers/exec';
import { dirpath as fixtures } from './helpers/fixtures';
import createNetlify, {
    NetlifyDeploy,
    requestLog2str,
} from './helpers/netlify-mock-server';
import { fileExists, isValidDate, readFile } from './helpers/utils';

function content(published: Date, modified: Date = published): string {
    return [
        `published: ${published.toISOString()}`,
        `modified: ${modified.toISOString()}`,
    ].join('\n');
}

function fileMeta(
    contents: string,
    key: 'published' | 'modified',
): Date | null {
    const match = new RegExp(String.raw`^${key}: ([^\n]+)$`, 'm').exec(
        contents,
    );
    if (match) {
        const date = new Date(match[1]);
        if (isValidDate(date)) {
            return date;
        }
    }
    return null;
}

function getPublishedDate(deploy: NetlifyDeploy): Date {
    return new Date(deploy.published_at || deploy.created_at);
}

const PROJECT_ROOT = path.resolve(__dirname, '..');

test.before(async t => {
    if (!(await fileExists(PROJECT_ROOT, 'dist', 'index.js'))) {
        t.log(
            await exec(['npm', 'run', 'build'], {
                cwd: PROJECT_ROOT,
            }),
        );
    }
});

test('should add correct dates to metadata', async t => {
    const fixturesDirpath = path.join(fixtures, 'cli');
    const siteID = 'cli.test';
    const server = await createNetlify(
        siteID,
        [
            {
                key: 'initial',
                '/initial.html': { filepath: 'initial.html' },
                '/modified.html': Buffer.from(''),
            },
            {},
            {
                key: 'added',
                '/added.html': { filepath: 'added.html' },
            },
            {
                key: 'modified',
                '/modified.html': { filepath: 'modified.html' },
            },
            {},
        ],
        { root: path.join(fixturesDirpath, 'src') },
    );

    t.log({
        deploys: server.deploys,
        previews: new Map(
            [...server.nockScope.previews.entries()].map(([url, scope]) => [
                url,
                scope.activeMocks(),
            ]),
        ),
        requestLogs: server.requestLogs,
    });

    const initialPublishedDate = getPublishedDate(
        server.deploys.getByKey('initial'),
    );
    const modifiedPublishedDate = getPublishedDate(
        server.deploys.getByKey('modified'),
    );
    const addedPublishedDate = getPublishedDate(
        server.deploys.getByKey('added'),
    );
    const lastPublishedDate = new Date(Date.now() - 1);

    t.log(
        await exec(
            [path.resolve(PROJECT_ROOT, 'node_modules', '.bin', 'metalsmith')],
            {
                cwd: fixturesDirpath,
                env: {
                    PATH: process.env.PATH,
                    URL: `https://${siteID}`,
                },
            },
        ),
    );

    const initialPagePreviewLogs = server.requestLogs.previews.filter(
        requestLog => requestLog.path === '/initial.html',
    );
    const modifiedPagePreviewLogs = server.requestLogs.previews.filter(
        requestLog => requestLog.path === '/modified.html',
    );
    const addedPagePreviewLogs = server.requestLogs.previews.filter(
        requestLog => requestLog.path === '/added.html',
    );
    const newPagePreviewLogs = server.requestLogs.previews.filter(
        requestLog => requestLog.path === '/new.html',
    );

    t.log({
        dates: {
            initialPublishedDate,
            modifiedPublishedDate,
            addedPublishedDate,
            lastPublishedDate,
        },
        requestLogs: {
            initialPagePreviewLogs: initialPagePreviewLogs.map(requestLog2str),
            modifiedPagePreviewLogs: modifiedPagePreviewLogs.map(
                requestLog2str,
            ),
            addedPagePreviewLogs: addedPagePreviewLogs.map(requestLog2str),
            newPagePreviewLogs: newPagePreviewLogs.map(requestLog2str),
        },
    });

    const destPath = path.join(fixturesDirpath, 'build');
    t.is(
        await readFile(destPath, 'initial.html'),
        content(initialPublishedDate),
    );
    t.is(
        await readFile(destPath, 'modified.html'),
        content(initialPublishedDate, modifiedPublishedDate),
    );
    t.is(await readFile(destPath, 'added.html'), content(addedPublishedDate));

    const newContents = await readFile(destPath, 'new.html');
    const newPublishedDate = fileMeta(newContents, 'published');
    const newModifiedDate = fileMeta(newContents, 'modified');
    t.true(newPublishedDate instanceof Date);
    if (newPublishedDate instanceof Date)
        t.true(newPublishedDate > lastPublishedDate);
    t.true(newModifiedDate instanceof Date);
    if (newModifiedDate instanceof Date)
        t.true(newModifiedDate > lastPublishedDate);

    t.is(
        initialPagePreviewLogs.length,
        server.deploys.length,
        'If the page was deployed initial, should have requested all the previews',
    );
    t.is(
        modifiedPagePreviewLogs.length,
        server.deploys.length,
        'If the page was deployed initial and modified midway, should have requested all the previews',
    );
    t.true(
        addedPagePreviewLogs.length < server.deploys.length,
        'If the page was deployed midway, should not have requested all previews',
    );
    t.is(
        newPagePreviewLogs.length,
        1,
        'If the page has not been deployed yet, should have requested only the first preview',
    );
});
