import test from 'ava';
import Metalsmith from 'metalsmith';
import path from 'path';
import util from 'util';

import netlifyPublishedDate from '../../src';
import { dirpath as fixtures } from '../helpers/fixtures';
import createNetlify, { requestLog2str } from '../helpers/netlify-mock-server';
import { convertMustachePlugin } from '../helpers/plugins';
import { getPublishedDate } from '../helpers/utils';

test('The metadataUpdater() option should be able to update file metadata', async t => {
    const siteID = 'opt-metadata-updater.index.test';
    const currentBuildDate = new Date();
    const metalsmith = Metalsmith(path.join(fixtures, 'template')).use(
        netlifyPublishedDate({
            pattern: ['**/*.html', '**/*.mustache'],
            filename2urlPath: filename =>
                filename.replace(/\.mustache$/, '.html'),
            siteID,
            cacheDir: null,
            defaultDate: currentBuildDate,
            plugins: [convertMustachePlugin()],
            metadataUpdater(previewContents, filedata) {
                const contents = previewContents.toString();
                const match = /\[([^[\]]+)\]/.exec(contents);
                if (match) {
                    const title = match[1];
                    filedata.title = title;
                }
            },
            contentsConverter(contents) {
                const origContent = contents.toString();
                const updatedContent = origContent.replace(
                    /^((?:Published|Last updated) at )[^\r\n]+$/gm,
                    '$1XXXX',
                );
                if (origContent === updatedContent) {
                    return contents;
                }
                return Buffer.from(updatedContent);
            },
        }),
    );
    const server = await createNetlify(
        siteID,
        [
            {
                key: 'initial',
            },
            {},
            {},
            {
                key: 'added',
                '/new.html': Buffer.from(
                    'Published at {{published}}\nLast updated at {{modified}}',
                ),
            },
            {
                '/new.html': Buffer.from(
                    'Published at {{published}}\nLast updated at {{modified}}',
                ),
            },
            {
                '/new.html': Buffer.from(
                    'Published at {{published}}\nLast updated at {{modified}}',
                ),
            },
            {
                key: 'modified',
                '/new.html': Buffer.from(
                    '[title]\n\nPublished at {{published}}\nLast updated at {{modified}}',
                ),
            },
            {
                '/new.html': Buffer.from(
                    '[hoge]\n\nPublished at {{published}}\nLast updated at {{modified}}',
                ),
            },
            {
                key: 'last',
                '/new.html': Buffer.from(
                    '[fuga]\n\nPublished at {{published}}\nLast updated at {{modified}}',
                ),
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
    const addedPublishedDate = getPublishedDate(
        server.deploys.getByKey('added'),
    );
    const modifiedPublishedDate = getPublishedDate(
        server.deploys.getByKey('modified'),
    );
    const lastPublishedDate = getPublishedDate(server.deploys.getByKey('last'));
    const newPagePreviewRequestExpectedCount =
        server.deploys.reduce((count, deploy) => {
            if (addedPublishedDate <= getPublishedDate(deploy)) {
                count++;
            }
            return count;
        }, 0) + 1;

    const files = await util.promisify(metalsmith.process.bind(metalsmith))();
    const newPagePreviewLogs = server.requestLogs.previews.filter(
        requestLog => requestLog.path === '/new.html',
    );

    t.log({
        files,
        dates: [
            { initialPublishedDate },
            { addedPublishedDate },
            { modifiedPublishedDate },
            { lastPublishedDate },
            { currentBuildDate },
        ],
        requestLogs: Object.assign(
            server.requestLogs.previews.map(requestLog2str),
            {
                newPagePreviewLogs: newPagePreviewLogs.map(requestLog2str),
            },
        ),
        requestLogsExpectedCount: {
            newPagePreviewRequestExpectedCount,
        },
    });

    t.deepEqual(files['new.html'].published, addedPublishedDate);
    t.deepEqual(files['new.html'].modified, modifiedPublishedDate);

    t.is(newPagePreviewLogs.length, newPagePreviewRequestExpectedCount);
});
