import test from 'ava';
import Metalsmith from 'metalsmith';
import path from 'path';
import util from 'util';

import netlifyPublishedDate from '../../src';
import { normalizeOptions } from '../../src/options';
import { OptionsInterface } from '../../src/plugin';
import { dirpath as fixtures } from '../helpers/fixtures';
import createNetlify, { requestLog2str } from '../helpers/netlify-mock-server';
import { convertMustachePlugin } from '../helpers/plugins';
import { appendValueReportPattern, getPublishedDate } from '../helpers/utils';

const metadata: Parameters<OptionsInterface['metadataUpdater']>[2] = {
    // DeployedPageMetadataInterface
    deploy: {
        /* eslint-disable @typescript-eslint/camelcase */
        id: '',
        state: '',
        name: '',
        deploy_ssl_url: '',
        commit_ref: null,
        created_at: '',
        updated_at: '',
        published_at: null,
        deployAbsoluteURL: '',
        /* eslint-enable */
    },
    previewPageResponse: null,
    cachedResponse: {
        body: Buffer.from([]),
        published: '',
    },
    // GeneratingPageMetadataInterface
    files: {},
    filename: '',
    fileData: { contents: Buffer.from([]) },
    metalsmith: Metalsmith(__dirname),
    previewURL: '',
};

test.before(() => {
    process.chdir(path.join(__dirname, 'fixtures'));
});

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
            async metadataUpdater(previewContents, filedata) {
                const contents = previewContents.toString();
                const match = /\[([^[\]]+)\]/.exec(contents);
                if (match) {
                    const title = match[1];
                    filedata.title = title;
                }
            },
            async contentsConverter(contents) {
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

test('The metadataUpdater() option should not be affected by the return value of the contentsConverter() option', async t => {
    const convertedBuf = Buffer.from([0xff, 0x00, 0xcf]);
    const siteID = 'execution-order.opt-metadata-updater.index.test';
    const metalsmith = Metalsmith(path.join(fixtures, 'basic')).use(
        netlifyPublishedDate({
            siteID,
            cacheDir: null,
            async metadataUpdater(previewContents) {
                t.not(previewContents, convertedBuf);
                t.false(previewContents.equals(convertedBuf));
            },
            async contentsConverter() {
                return convertedBuf;
            },
        }),
    );
    await createNetlify(
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
        { root: metalsmith.source() },
    );

    await util.promisify(metalsmith.process.bind(metalsmith))();
});

test('should pass the function to the options value', async t => {
    const func: OptionsInterface['metadataUpdater'] = (_, filedata) => {
        filedata.x = 42;
    };
    const options = normalizeOptions(
        {
            metadataUpdater: func,
        },
        netlifyPublishedDate.defaultOptions,
    );

    const filedata = {};
    await options.metadataUpdater(Buffer.from([]), filedata, metadata);

    t.deepEqual(filedata, { x: 42 });
});

test('should import external script file', async t => {
    const options = normalizeOptions(
        {
            metadataUpdater: './mod.update-metadata.js',
        },
        netlifyPublishedDate.defaultOptions,
    );

    const filedata = {};
    await options.metadataUpdater(Buffer.from([]), filedata, metadata);

    t.deepEqual(filedata, { x: 42 });
});

test('should import external script file without .js extension', async t => {
    const options = normalizeOptions(
        {
            metadataUpdater: './mod.update-metadata',
        },
        netlifyPublishedDate.defaultOptions,
    );

    const filedata = {};
    await options.metadataUpdater(Buffer.from([]), filedata, metadata);

    t.deepEqual(filedata, { x: 42 });
});

test('should import external script file that returns a promise', async t => {
    const options = normalizeOptions(
        {
            metadataUpdater: './async-mod.update-metadata',
        },
        netlifyPublishedDate.defaultOptions,
    );

    const filedata = {};
    await options.metadataUpdater(Buffer.from([]), filedata, metadata);

    t.deepEqual(filedata, { x: 42 });
});

test('import of script files that do not export functions should fail', t => {
    t.throws(
        () => {
            normalizeOptions(
                {
                    metadataUpdater: './no-func',
                },
                netlifyPublishedDate.defaultOptions,
            );
        },
        {
            instanceOf: TypeError,
            message: appendValueReportPattern(
                /[Mm]odule "\.\/no-func" .* option "metadataUpdater" .* not export the function/,
                // Note: In order to avoid the side effects of esModuleInterop, require() is used.
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                require('./fixtures/no-func'),
            ),
        },
    );
});

test('import of non-existent script file should fail', t => {
    t.throws(
        () => {
            normalizeOptions(
                {
                    metadataUpdater: './not-found-mod',
                },
                netlifyPublishedDate.defaultOptions,
            );
        },
        {
            instanceOf: TypeError,
            message: /[Ff]ailed to import module "\.\/not-found-mod" .* option "metadataUpdater"/,
        },
    );
});

test('If the module name does not start with "." and "/", should to import it like require() function', t => {
    t.throws(
        () => {
            normalizeOptions(
                {
                    metadataUpdater: '@sounisi5011/example',
                },
                netlifyPublishedDate.defaultOptions,
            );
        },
        {
            instanceOf: TypeError,
            message: /[Ff]ailed to import module "@sounisi5011\/example" .* option "metadataUpdater"/,
        },
    );
});
