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

test('filesystem', async t => {
    const siteID = 'filesystem.cache.test';
    const metalsmith = Metalsmith(path.join(fixtures, 'basic'));
    const cacheDir = path.join(metalsmith.directory(), 'cache');

    await del(cacheDir);

    const server = await createNetlify(siteID, {
        root: metalsmith.source(),
        initial: 'initial.html',
        modified: 'modified.html',
        added: 'added.html',
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

    t.true(
        (await fsStat(cacheDir)).isDirectory(),
        'cache directory should exist',
    );

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
            netlifyPublishedDate({
                siteID,
                cacheDir: null,
                defaultDate: new Date(),
            }),
        );
    const server = await createNetlify(siteID, {
        root: metalsmith.source(),
        initial: 'initial.html',
        modified: 'modified.html',
        added: 'added.html',
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
