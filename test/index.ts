import test from 'ava';
import Metalsmith from 'metalsmith';
import path from 'path';

import netlifyPublishedDate from '../src/index';
import { dirpath as fixtures } from './helpers/fixtures';
import { buildAsync, processAsync } from './helpers/metalsmith';
import createNetlify, { requestLog2str } from './helpers/netlify-mock-server';
import { getPublishedDate, hasProp } from './helpers/utils';

test.serial('should add correct dates to metadata', async t => {
    const metalsmith = Metalsmith(path.join(fixtures, 'basic')).use(
        netlifyPublishedDate({
            siteID: 'example.net',
            cacheDir: null,
        }),
    );
    const server = await createNetlify(
        'example.net',
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
        { root: metalsmith.source() },
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
    const beforeBuildDate = new Date(Date.now() - 1);

    const files = await buildAsync(metalsmith);
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
        files,
        dates: [
            { initialPublishedDate },
            { modifiedPublishedDate },
            { addedPublishedDate },
            { beforeBuildDate },
        ],
        requestLogs: Object.assign(
            server.requestLogs.previews.map(requestLog2str),
            {
                initialPagePreviewLogs: initialPagePreviewLogs.map(
                    requestLog2str,
                ),
                modifiedPagePreviewLogs: modifiedPagePreviewLogs.map(
                    requestLog2str,
                ),
                addedPagePreviewLogs: addedPagePreviewLogs.map(requestLog2str),
                newPagePreviewLogs: newPagePreviewLogs.map(requestLog2str),
            },
        ),
    });

    t.deepEqual(files['initial.html'].published, initialPublishedDate);
    t.deepEqual(files['initial.html'].modified, initialPublishedDate);

    t.deepEqual(files['modified.html'].published, initialPublishedDate);
    t.deepEqual(files['modified.html'].modified, modifiedPublishedDate);

    t.deepEqual(files['added.html'].published, addedPublishedDate);
    t.deepEqual(files['added.html'].modified, addedPublishedDate);

    t.true(files['new.html'].published instanceof Date);
    t.true(files['new.html'].published > beforeBuildDate);
    t.true(files['new.html'].modified instanceof Date);
    t.true(files['new.html'].modified > beforeBuildDate);

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
    t.is(
        addedPagePreviewLogs.length,
        server.deploys.getsUntilByKey('added').length + 1,
        'If the page was deployed midway, should not have requested all previews',
    );
    t.is(
        newPagePreviewLogs.length,
        1,
        'If the page has not been deployed yet, should have requested only the first preview',
    );
});

test('should not process files that do not match by pattern', async t => {
    const server = await createNetlify('do-not-match.test');
    const metalsmith = Metalsmith(path.join(fixtures, 'basic')).use(
        netlifyPublishedDate({
            pattern: ['*.do-not-match-pattern'],
            siteID: 'do-not-match.test',
            cacheDir: null,
        }),
    );

    const files = await processAsync(metalsmith);

    if (
        Object.values(files).some(filedata =>
            hasProp(filedata, ['published', 'modified']),
        )
    ) {
        t.fail(
            '"published" or "modified" property have been added to some files metadata',
        );
        t.log(files);
    }
    t.is(
        server.requestLogs.api.length,
        0,
        'Do not fetch Netlify API if there is no file that matches the pattern',
    );
});

test('should add correct dates to metadata in binary files', async t => {
    const siteID = 'binary-files.index.test';
    const metalsmith = Metalsmith(path.join(fixtures, 'binary')).use(
        netlifyPublishedDate({
            pattern: '*',
            siteID,
            cacheDir: null,
        }),
    );
    const server = await createNetlify(
        siteID,
        [
            {
                key: 'initial',
                '/initial.png': { filepath: 'initial.png' },
                '/modified.webp': { filepath: 'modified.orig.webp' },
            },
            {},
            {
                key: 'added',
                '/added.gif': { filepath: 'added.gif' },
            },
            {
                key: 'modified',
                '/modified.webp': { filepath: 'modified.webp' },
            },
            {},
        ],
        { root: metalsmith.source() },
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
    const beforeBuildDate = new Date(Date.now() - 1);

    const files = await processAsync(metalsmith);
    const initialPagePreviewLogs = server.requestLogs.previews.filter(
        requestLog => requestLog.path === '/initial.png',
    );
    const modifiedPagePreviewLogs = server.requestLogs.previews.filter(
        requestLog => requestLog.path === '/modified.webp',
    );
    const addedPagePreviewLogs = server.requestLogs.previews.filter(
        requestLog => requestLog.path === '/added.gif',
    );
    const newPagePreviewLogs = server.requestLogs.previews.filter(
        requestLog => requestLog.path === '/new.jp2',
    );

    t.log({
        files,
        dates: [
            { initialPublishedDate },
            { modifiedPublishedDate },
            { addedPublishedDate },
            { beforeBuildDate },
        ],
        requestLogs: Object.assign(
            server.requestLogs.previews.map(requestLog2str),
            {
                initialPagePreviewLogs: initialPagePreviewLogs.map(
                    requestLog2str,
                ),
                modifiedPagePreviewLogs: modifiedPagePreviewLogs.map(
                    requestLog2str,
                ),
                addedPagePreviewLogs: addedPagePreviewLogs.map(requestLog2str),
                newPagePreviewLogs: newPagePreviewLogs.map(requestLog2str),
            },
        ),
    });

    t.deepEqual(files['initial.png'].published, initialPublishedDate);
    t.deepEqual(files['initial.png'].modified, initialPublishedDate);

    t.deepEqual(files['modified.webp'].published, initialPublishedDate);
    t.deepEqual(files['modified.webp'].modified, modifiedPublishedDate);

    t.deepEqual(files['added.gif'].published, addedPublishedDate);
    t.deepEqual(files['added.gif'].modified, addedPublishedDate);

    t.true(files['new.jp2'].published instanceof Date);
    t.true(files['new.jp2'].published > beforeBuildDate);
    t.true(files['new.jp2'].modified instanceof Date);
    t.true(files['new.jp2'].modified > beforeBuildDate);

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
    t.is(
        addedPagePreviewLogs.length,
        server.deploys.getsUntilByKey('added').length + 1,
        'If the page was deployed midway, should not have requested all previews',
    );
    t.is(
        newPagePreviewLogs.length,
        1,
        'If the page has not been deployed yet, should have requested only the first preview',
    );
});

test('failed deploy should be ignored', async t => {
    const siteID = 'build-fail.index.test';
    const metalsmith = Metalsmith(path.join(fixtures, 'basic')).use(
        netlifyPublishedDate({
            siteID,
            cacheDir: null,
        }),
    );
    const server = await createNetlify(
        siteID,
        [
            {
                key: 'initial',
                '/initial.html': { filepath: 'initial.html' },
                '/modified.html': Buffer.from(''),
            },
            {
                state: 'error',
            },
            {
                key: 'modified',
                '/modified.html': { filepath: 'modified.html' },
            },
            {},
        ],
        { root: metalsmith.source() },
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

    const files = await processAsync(metalsmith);
    const initialPagePreviewLogs = server.requestLogs.previews.filter(
        requestLog => requestLog.path === '/initial.html',
    );
    const modifiedPagePreviewLogs = server.requestLogs.previews.filter(
        requestLog => requestLog.path === '/modified.html',
    );

    t.log({
        files,
        dates: [{ initialPublishedDate }, { modifiedPublishedDate }],
        requestLogs: Object.assign(
            server.requestLogs.previews.map(requestLog2str),
            {
                initialPagePreviewLogs: initialPagePreviewLogs.map(
                    requestLog2str,
                ),
                modifiedPagePreviewLogs: modifiedPagePreviewLogs.map(
                    requestLog2str,
                ),
            },
        ),
    });

    t.deepEqual(files['initial.html'].published, initialPublishedDate);
    t.deepEqual(files['initial.html'].modified, initialPublishedDate);

    t.deepEqual(files['modified.html'].published, initialPublishedDate);
    t.deepEqual(files['modified.html'].modified, modifiedPublishedDate);
});

test('enqueued and building deploy should be ignored', async t => {
    const siteID = 'build-in-progress.index.test';
    const metalsmith = Metalsmith(path.join(fixtures, 'basic')).use(
        netlifyPublishedDate({
            siteID,
            cacheDir: null,
        }),
    );
    const server = await createNetlify(
        siteID,
        [
            {
                key: 'initial',
                '/initial.html': { filepath: 'initial.html' },
                '/modified.html': Buffer.from(''),
            },
            {
                key: 'modified',
                '/modified.html': { filepath: 'modified.html' },
            },
            {
                state: 'building',
            },
            {
                state: 'enqueued',
            },
        ],
        { root: metalsmith.source() },
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

    const files = await processAsync(metalsmith);
    const initialPagePreviewLogs = server.requestLogs.previews.filter(
        requestLog => requestLog.path === '/initial.html',
    );
    const modifiedPagePreviewLogs = server.requestLogs.previews.filter(
        requestLog => requestLog.path === '/modified.html',
    );

    t.log({
        files,
        dates: [{ initialPublishedDate }, { modifiedPublishedDate }],
        requestLogs: Object.assign(
            server.requestLogs.previews.map(requestLog2str),
            {
                initialPagePreviewLogs: initialPagePreviewLogs.map(
                    requestLog2str,
                ),
                modifiedPagePreviewLogs: modifiedPagePreviewLogs.map(
                    requestLog2str,
                ),
            },
        ),
    });

    t.deepEqual(files['initial.html'].published, initialPublishedDate);
    t.deepEqual(files['initial.html'].modified, initialPublishedDate);

    t.deepEqual(files['modified.html'].published, initialPublishedDate);
    t.deepEqual(files['modified.html'].modified, modifiedPublishedDate);
});
