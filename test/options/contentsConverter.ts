import test from 'ava';
import Metalsmith from 'metalsmith';
import path from 'path';

import netlifyPublishedDate from '../../src';
import { normalizeOptions } from '../../src/options';
import { OptionsInterface } from '../../src/plugin';
import { dirpath as fixtures } from '../helpers/fixtures';
import { processAsync } from '../helpers/metalsmith';
import createNetlify, { requestLog2str } from '../helpers/netlify-mock-server';
import { appendValueReportPattern, getPublishedDate } from '../helpers/utils';

const metadata = {
    files: {},
    filename: '',
    fileData: { contents: Buffer.from([]) },
    metalsmith: Metalsmith(__dirname),
};

test.before(() => {
    process.chdir(path.join(__dirname, 'fixtures'));
});

test('The return value of the contentsConverter() option should be used for comparison: equals value', async t => {
    const siteID = 'equals.opt-contents-converter.index.test';
    const currentBuildDate = new Date();
    const metalsmith = Metalsmith(path.join(fixtures, 'basic')).use(
        netlifyPublishedDate({
            siteID,
            cacheDir: null,
            defaultDate: currentBuildDate,
            async contentsConverter() {
                return Buffer.from([0xf0]);
            },
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
            {},
            {
                key: 'added',
                '/added.html': { filepath: 'added.html' },
            },
            {
                key: 'modified',
                '/modified.html': { filepath: 'modified.html' },
            },
            {
                key: 'last',
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

    const files = await processAsync(metalsmith);
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
            { addedPublishedDate },
            { modifiedPublishedDate },
            { lastPublishedDate },
            { currentBuildDate },
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
    t.deepEqual(files['modified.html'].modified, initialPublishedDate);

    t.deepEqual(files['added.html'].published, addedPublishedDate);
    t.deepEqual(files['added.html'].modified, addedPublishedDate);

    t.deepEqual(files['new.html'].published, currentBuildDate);
    t.deepEqual(files['new.html'].modified, currentBuildDate);

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

test('The return value of the contentsConverter() option should be used for comparison: non-equals value', async t => {
    let i = 0;
    const siteID = 'non-equals.opt-contents-converter.index.test';
    const currentBuildDate = new Date();
    const metalsmith = Metalsmith(path.join(fixtures, 'basic')).use(
        netlifyPublishedDate({
            siteID,
            cacheDir: null,
            defaultDate: currentBuildDate,
            async contentsConverter() {
                return Buffer.from([0xf0, i++]);
            },
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
            {},
            {
                key: 'added',
                '/added.html': { filepath: 'added.html' },
            },
            {
                key: 'modified',
                '/modified.html': { filepath: 'modified.html' },
            },
            {
                key: 'last',
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

    const files = await processAsync(metalsmith);
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
            { addedPublishedDate },
            { modifiedPublishedDate },
            { lastPublishedDate },
            { currentBuildDate },
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
    t.deepEqual(files['initial.html'].modified, currentBuildDate);

    t.deepEqual(files['modified.html'].published, initialPublishedDate);
    t.deepEqual(files['modified.html'].modified, currentBuildDate);

    t.deepEqual(files['added.html'].published, addedPublishedDate);
    t.deepEqual(files['added.html'].modified, currentBuildDate);

    t.deepEqual(files['new.html'].published, currentBuildDate);
    t.deepEqual(files['new.html'].modified, currentBuildDate);

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

test('should pass the function to the options value', async t => {
    const func: OptionsInterface['contentsConverter'] = (
        contents: Buffer,
    ): Buffer => contents;
    const options = normalizeOptions(
        {
            contentsConverter: func,
        },
        netlifyPublishedDate.defaultOptions,
    );

    const args: Parameters<OptionsInterface['contentsConverter']> = [
        Buffer.from(Math.random().toString(36)),
        metadata,
    ];
    t.deepEqual(await options.contentsConverter(...args), await func(...args));
});

test('should import external script file', async t => {
    const options = normalizeOptions(
        {
            contentsConverter: './mod.ret-buffer.js',
        },
        netlifyPublishedDate.defaultOptions,
    );

    t.deepEqual(
        await options.contentsConverter(Buffer.from(''), metadata),
        Buffer.from('42'),
    );
});

test('should import external script file without .js extension', async t => {
    const options = normalizeOptions(
        {
            contentsConverter: './mod.ret-buffer',
        },
        netlifyPublishedDate.defaultOptions,
    );

    t.deepEqual(
        await options.contentsConverter(Buffer.from(''), metadata),
        Buffer.from('42'),
    );
});

test('should import external script file that returns a promise', async t => {
    const options = normalizeOptions(
        {
            contentsConverter: './async-mod.ret-buffer',
        },
        netlifyPublishedDate.defaultOptions,
    );

    t.deepEqual(
        await options.contentsConverter(Buffer.from(''), metadata),
        Buffer.from('42'),
    );
});

test('import of script files exporting functions that do not return Buffer should fail', async t => {
    await t.throwsAsync(
        async () => {
            const options = normalizeOptions(
                {
                    contentsConverter: './invalid-func',
                },
                netlifyPublishedDate.defaultOptions,
            );

            await options.contentsConverter(Buffer.from(''), metadata);
        },
        {
            instanceOf: TypeError,
            message: appendValueReportPattern(
                /[Mm]odule "\.\/invalid-func" .* option "contentsConverter" .* not return a Buffer/,
                // Note: In order to avoid the side effects of esModuleInterop, require() is used.
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                require('./fixtures/invalid-func')(),
            ),
        },
    );
});

test('import of script files exporting functions that do not return Promise<Buffer> should fail', async t => {
    await t.throwsAsync(
        async () => {
            const options = normalizeOptions(
                {
                    contentsConverter: './async-mod.ret-number',
                },
                netlifyPublishedDate.defaultOptions,
            );

            await options.contentsConverter(Buffer.from(''), metadata);
        },
        {
            instanceOf: TypeError,
            message: appendValueReportPattern(
                /[Mm]odule "\.\/async-mod.ret-number" .* option "contentsConverter" .* not return a Buffer/,
                // Note: In order to avoid the side effects of esModuleInterop, require() is used.
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                await require('./fixtures/async-mod.ret-number')(),
            ),
        },
    );
});

test('import of script files that do not export functions should fail', t => {
    t.throws(
        () => {
            normalizeOptions(
                {
                    contentsConverter: './no-func',
                },
                netlifyPublishedDate.defaultOptions,
            );
        },
        {
            instanceOf: TypeError,
            message: appendValueReportPattern(
                /[Mm]odule "\.\/no-func" .* option "contentsConverter" .* not export the function/,
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
                    contentsConverter: './not-found-mod',
                },
                netlifyPublishedDate.defaultOptions,
            );
        },
        {
            instanceOf: TypeError,
            message: /[Ff]ailed to import module "\.\/not-found-mod" .* option "contentsConverter"/,
        },
    );
});

test('If the module name does not start with "." and "/", should to import it like require() function', t => {
    t.throws(
        () => {
            normalizeOptions(
                {
                    contentsConverter: '@sounisi5011/example',
                },
                netlifyPublishedDate.defaultOptions,
            );
        },
        {
            instanceOf: TypeError,
            message: /[Ff]ailed to import module "@sounisi5011\/example" .* option "contentsConverter"/,
        },
    );
});
