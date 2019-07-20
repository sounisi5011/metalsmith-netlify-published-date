import test from 'ava';
import Metalsmith from 'metalsmith';
import path from 'path';
import util from 'util';

import netlifyPublishedDate from '../src/index';
import { dirpath as fixtures } from './helpers/fixtures';
import createNetlify from './helpers/netlify-mock-server';

test.serial('should add correct dates to metadata', async t => {
    const metalsmith = Metalsmith(path.join(fixtures, 'basic'));
    const server = await createNetlify('example.net', {
        root: metalsmith.source(),
        initial: 'initial.html',
        modified: 'modified.html',
        added: 'added.html',
    });

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

    const initialPublishedDate = new Date(
        server.deploys.initial.published_at ||
            server.deploys.initial.created_at,
    );
    const modifiedPublishedDate = new Date(
        server.deploys.modified.published_at ||
            server.deploys.modified.created_at,
    );
    const addedPublishedDate = new Date(
        server.deploys.added.published_at || server.deploys.added.created_at,
    );
    const lastPublishedDate = new Date(Date.now() - 1);

    metalsmith.use(
        netlifyPublishedDate({
            siteID: 'example.net',
            cacheDir: path.join(metalsmith.directory(), 'cache'),
        }),
    );

    const files = await util.promisify(metalsmith.build.bind(metalsmith))();
    const initialPagePreviewLogs = server.requestLogs.initial;
    const modifiedPagePreviewLogs = server.requestLogs.modified;
    const addedPagePreviewLogs = server.requestLogs.added;
    const newPagePreviewLogs = server.requestLogs.previews.filter(
        requestLog => requestLog.path === '/new.html',
    );

    t.log({
        files,
        dates: {
            initialPublishedDate,
            modifiedPublishedDate,
            addedPublishedDate,
            lastPublishedDate,
        },
        requestLogs: {
            initialPagePreviewLogs,
            modifiedPagePreviewLogs,
            addedPagePreviewLogs,
            newPagePreviewLogs,
        },
    });

    t.deepEqual(files['initial.html'].published, initialPublishedDate);
    t.deepEqual(files['initial.html'].modified, initialPublishedDate);

    t.deepEqual(files['modified.html'].published, initialPublishedDate);
    t.deepEqual(files['modified.html'].modified, modifiedPublishedDate);

    t.deepEqual(files['added.html'].published, addedPublishedDate);
    t.deepEqual(files['added.html'].modified, addedPublishedDate);

    t.true(files['new.html'].published instanceof Date);
    t.true(files['new.html'].published > lastPublishedDate);
    t.true(files['new.html'].modified instanceof Date);
    t.true(files['new.html'].modified > lastPublishedDate);

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
