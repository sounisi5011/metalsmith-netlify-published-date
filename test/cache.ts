import test from 'ava';
import del from 'del';
import fs from 'fs';
import Metalsmith from 'metalsmith';
import path from 'path';
import util from 'util';

import netlifyPublishedDate from '../src/index';
import { isObject } from '../src/utils';
import { dirpath as fixtures } from './helpers/fixtures';
import createNetlify from './helpers/netlify-mock-server';
import { ArrayType } from './helpers/types';

const fsStat = util.promisify(fs.stat);

function stripFileStatsPlugin(): Metalsmith.Plugin {
    return (files, metalsmith, done) => {
        Object.values(files).forEach(file => {
            if (isObject(file) && file.stats instanceof fs.Stats) {
                delete file.stats;
            }
        });
        done(null, files, metalsmith);
    };
}

function processEachGenPlugin<T>(
    pluginGenerator: (opts: T) => Metalsmith.Plugin,
    options: T,
): Metalsmith.Plugin {
    return (files, metalsmith, done) => {
        const plugin = pluginGenerator(options);
        plugin(files, metalsmith, done);
    };
}

const serverScheme = [
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
];

test('filesystem', async t => {
    const siteID = 'filesystem.cache.test';
    const metalsmith = Metalsmith(path.join(fixtures, 'basic'));
    const cacheDir = path.join(metalsmith.directory(), 'cache', siteID);

    await del(cacheDir);

    const server = await createNetlify(siteID, serverScheme, {
        root: metalsmith.source(),
    });

    metalsmith.use(stripFileStatsPlugin()).use(
        processEachGenPlugin(netlifyPublishedDate, {
            siteID,
            cacheDir,
            defaultDate: new Date(),
        }),
    );

    const firstFiles = await util.promisify(
        metalsmith.process.bind(metalsmith),
    )();
    const firstApiLogs = [...server.requestLogs.api];
    const firstApiLogLen = server.requestLogs.api.length;
    const firstPreviewsLogs = [...server.requestLogs.previews];
    const firstPreviewsLogLen = server.requestLogs.previews.length;

    t.notThrowsAsync(async () => {
        t.true(
            (await fsStat(cacheDir)).isDirectory(),
            'cache directory should exist',
        );
    }, 'cache directory should exist');

    const secondFiles = await util.promisify(
        metalsmith.process.bind(metalsmith),
    )();
    const secondApiLogs = server.requestLogs.api.slice(firstApiLogLen);
    const secondApiLogLen = server.requestLogs.api.length;
    const secondPreviewsLogs = server.requestLogs.previews.slice(
        firstPreviewsLogLen,
    );
    const secondPreviewsLogLen = server.requestLogs.previews.length;

    const thirdFiles = await util.promisify(
        metalsmith.process.bind(metalsmith),
    )();
    const thirdApiLogs = server.requestLogs.api.slice(secondApiLogLen);
    const thirdPreviewsLogs = server.requestLogs.previews.slice(
        secondPreviewsLogLen,
    );

    t.deepEqual(
        secondFiles,
        firstFiles,
        'generated files metadata should be the same',
    );
    t.notDeepEqual(secondApiLogs, [], 'API requests should not be cached');
    t.deepEqual(
        secondApiLogs,
        firstApiLogs,
        'API requests should not be cached',
    );
    t.notDeepEqual(
        secondPreviewsLogs,
        firstPreviewsLogs,
        'cache should be shared within each Node.js process',
    );
    t.deepEqual(
        secondPreviewsLogs,
        firstPreviewsLogs.filter(requestLog => requestLog.statusCode === 404),
        'should not fetch anything other than a preview that returned 404 Not Found',
    );

    t.deepEqual(
        thirdFiles,
        firstFiles,
        'generated files metadata should be the same',
    );
    t.notDeepEqual(thirdApiLogs, [], 'API requests should not be cached');
    t.deepEqual(
        thirdApiLogs,
        firstApiLogs,
        'API requests should not be cached',
    );
    t.deepEqual(
        thirdPreviewsLogs,
        firstPreviewsLogs.filter(requestLog => requestLog.statusCode === 404),
        'should not fetch anything other than a preview that returned 404 Not Found',
    );
});

test('in-memory', async t => {
    const siteID = 'in-memory.cache.test';
    const metalsmith = Metalsmith(path.join(fixtures, 'basic'))
        .use(stripFileStatsPlugin())
        .use(
            processEachGenPlugin(netlifyPublishedDate, {
                siteID,
                cacheDir: null,
                defaultDate: new Date(),
            }),
        );
    const server = await createNetlify(siteID, serverScheme, {
        root: metalsmith.source(),
    });

    const firstFiles = await util.promisify(
        metalsmith.process.bind(metalsmith),
    )();
    const firstApiLogs = [...server.requestLogs.api];
    const firstApiLogLen = server.requestLogs.api.length;
    const firstPreviewsLogs = [...server.requestLogs.previews];
    const firstPreviewsLogLen = server.requestLogs.previews.length;

    const secondFiles = await util.promisify(
        metalsmith.process.bind(metalsmith),
    )();
    const secondApiLogs = server.requestLogs.api.slice(firstApiLogLen);
    const secondApiLogLen = server.requestLogs.api.length;
    const secondPreviewsLogs = server.requestLogs.previews.slice(
        firstPreviewsLogLen,
    );
    const secondPreviewsLogLen = server.requestLogs.previews.length;

    const thirdFiles = await util.promisify(
        metalsmith.process.bind(metalsmith),
    )();
    const thirdApiLogs = server.requestLogs.api.slice(secondApiLogLen);
    const thirdPreviewsLogs = server.requestLogs.previews.slice(
        secondPreviewsLogLen,
    );

    t.deepEqual(
        secondFiles,
        firstFiles,
        'generated files metadata should be the same',
    );
    t.notDeepEqual(secondApiLogs, [], 'API requests should not be cached');
    t.deepEqual(
        secondApiLogs,
        firstApiLogs,
        'API requests should not be cached',
    );
    t.notDeepEqual(
        secondPreviewsLogs,
        firstPreviewsLogs,
        'cache should be shared within each Node.js process',
    );
    t.deepEqual(
        secondPreviewsLogs,
        firstPreviewsLogs.filter(requestLog => requestLog.statusCode === 404),
        'should not fetch anything other than a preview that returned 404 Not Found',
    );

    t.deepEqual(
        thirdFiles,
        firstFiles,
        'generated files metadata should be the same',
    );
    t.notDeepEqual(thirdApiLogs, [], 'API requests should not be cached');
    t.deepEqual(
        thirdApiLogs,
        firstApiLogs,
        'API requests should not be cached',
    );
    t.deepEqual(
        thirdPreviewsLogs,
        firstPreviewsLogs.filter(requestLog => requestLog.statusCode === 404),
        'should not fetch anything other than a preview that returned 404 Not Found',
    );
});

test('filesystem: unread cache entries should also be kept', async t => {
    const siteID = 'unread-cache-entries-kept.cache.test';
    const defaultDate = new Date();
    const metalsmith = Metalsmith(path.join(fixtures, 'basic'));
    const cacheDir = path.join(metalsmith.directory(), 'cache', siteID);
    const server = await createNetlify(siteID, serverScheme, {
        root: metalsmith.source(),
    });

    let firstFiles: Metalsmith.Files = {};
    let firstApiLogs: typeof server.requestLogs.api = [];
    let firstApiLogLen = 0;
    let firstPreviewsLogs: ArrayType<typeof server.requestLogs.previews> = [];
    let firstPreviewsLogLen = 0;

    let secondFiles: Metalsmith.Files = {};
    let secondApiLogs: typeof server.requestLogs.api = [];
    let secondApiLogLen = 0;
    let secondPreviewsLogs: ArrayType<typeof server.requestLogs.previews> = [];
    let secondPreviewsLogLen = 0;

    await del(cacheDir);

    const thirdFiles = await util.promisify(
        metalsmith
            .use(
                netlifyPublishedDate({
                    siteID,
                    cacheDir,
                    defaultDate,
                }),
            )
            .use((files, metalsmith, done) => {
                const { api, previews } = server.requestLogs;
                firstFiles = files;
                firstApiLogs = [...api];
                firstApiLogLen = api.length;
                firstPreviewsLogs = [...previews];
                firstPreviewsLogLen = previews.length;
                done(null, files, metalsmith);
            })
            .use(
                netlifyPublishedDate({
                    pattern: 'modified.html',
                    siteID,
                    cacheDir,
                    defaultDate,
                }),
            )
            .use((files, metalsmith, done) => {
                const { api, previews } = server.requestLogs;
                secondFiles = files;
                secondApiLogs = api.slice(firstApiLogLen);
                secondApiLogLen = api.length;
                secondPreviewsLogs = previews.slice(firstPreviewsLogLen);
                secondPreviewsLogLen = previews.length;
                done(null, files, metalsmith);
            })
            .use(
                netlifyPublishedDate({
                    siteID,
                    cacheDir,
                    defaultDate,
                }),
            )
            .process.bind(metalsmith),
    )();
    const thirdApiLogs = server.requestLogs.api.slice(secondApiLogLen);
    const thirdPreviewsLogs = server.requestLogs.previews.slice(
        secondPreviewsLogLen,
    );

    const modifiedOnlyFirstPreviewsLogs = firstPreviewsLogs.filter(
        requestLog => requestLog.path === '/modified.html',
    );

    t.deepEqual(
        secondFiles,
        firstFiles,
        'generated files metadata should be the same',
    );
    t.notDeepEqual(secondApiLogs, [], 'API requests should not be cached');
    t.deepEqual(
        secondApiLogs,
        firstApiLogs,
        'API requests should not be cached',
    );
    t.notDeepEqual(
        secondPreviewsLogs,
        modifiedOnlyFirstPreviewsLogs,
        'cache should be shared within each Node.js process',
    );
    t.deepEqual(
        secondPreviewsLogs,
        modifiedOnlyFirstPreviewsLogs.filter(
            requestLog => requestLog.statusCode === 404,
        ),
        'should not fetch anything other than a preview that returned 404 Not Found',
    );

    t.deepEqual(
        thirdFiles,
        firstFiles,
        'generated files metadata should be the same',
    );
    t.notDeepEqual(thirdApiLogs, [], 'API requests should not be cached');
    t.deepEqual(
        thirdApiLogs,
        firstApiLogs,
        'API requests should not be cached',
    );
    t.deepEqual(
        thirdPreviewsLogs,
        firstPreviewsLogs.filter(requestLog => requestLog.statusCode === 404),
        'should not fetch anything other than a preview that returned 404 Not Found',
    );
});
