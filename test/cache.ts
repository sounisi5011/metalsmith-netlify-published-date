import test from 'ava';
import del from 'del';
import fs from 'fs';
import Metalsmith from 'metalsmith';
import path from 'path';
import util from 'util';

import netlifyPublishedDate from '../src/index';
import { isObject } from '../src/utils';
import { dirpath as fixtures } from './helpers/fixtures';
import { processAsync } from './helpers/metalsmith';
import createNetlify from './helpers/netlify-mock-server';
import { ArrayType } from './helpers/types';
import { getNewItems } from './helpers/utils';

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

    const firstFiles = await processAsync(metalsmith);
    const firstApiLogs = getNewItems(server.requestLogs.api);
    const firstPreviewsLogs = getNewItems(server.requestLogs.previews);

    await t.notThrowsAsync(async () => {
        t.true(
            (await fsStat(cacheDir)).isDirectory(),
            'cache directory should exist',
        );
    }, 'cache directory should exist');

    const secondFiles = await processAsync(metalsmith);
    const secondApiLogs = getNewItems(server.requestLogs.api);
    const secondPreviewsLogs = getNewItems(server.requestLogs.previews);

    const thirdFiles = await processAsync(metalsmith);
    const thirdApiLogs = getNewItems(server.requestLogs.api);
    const thirdPreviewsLogs = getNewItems(server.requestLogs.previews);

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

    const firstFiles = await processAsync(metalsmith);
    const firstApiLogs = getNewItems(server.requestLogs.api);
    const firstPreviewsLogs = getNewItems(server.requestLogs.previews);

    const secondFiles = await processAsync(metalsmith);
    const secondApiLogs = getNewItems(server.requestLogs.api);
    const secondPreviewsLogs = getNewItems(server.requestLogs.previews);

    const thirdFiles = await processAsync(metalsmith);
    const thirdApiLogs = getNewItems(server.requestLogs.api);
    const thirdPreviewsLogs = getNewItems(server.requestLogs.previews);

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
    const modifiedDeployIndex = server.deploys.indexOf(
        server.deploys.getByKey('modified'),
    );

    let firstFiles: Metalsmith.Files = {};
    let firstApiLogs: typeof server.requestLogs.api = [];
    let firstPreviewsLogs: ArrayType<typeof server.requestLogs.previews> = [];

    let secondFiles: Metalsmith.Files = {};
    let secondApiLogs: typeof server.requestLogs.api = [];
    let secondPreviewsLogs: ArrayType<typeof server.requestLogs.previews> = [];

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
                firstApiLogs = getNewItems(api);
                firstPreviewsLogs = getNewItems(previews);
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
                secondApiLogs = getNewItems(api);
                secondPreviewsLogs = getNewItems(previews);
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
    const thirdApiLogs = getNewItems(server.requestLogs.api);
    const thirdPreviewsLogs = getNewItems(server.requestLogs.previews);

    const modifiedOnlyFirstApiLogs = firstApiLogs.slice(
        0,
        modifiedDeployIndex + 1,
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
    /*
     * Fetches the range from the latest deploy to the deploy where the modified.html file is modified.
     * In addition, the previous deploy of the modified deploy is also fetched.
     * This is because you cannot know that the modified.html file has changed unless you check the modified.html file before it is changed.
     */
    t.deepEqual(
        secondApiLogs,
        [...modifiedOnlyFirstApiLogs, firstApiLogs[modifiedDeployIndex + 1]],
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
