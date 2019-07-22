import anyTest, { TestInterface } from 'ava';
import Metalsmith from 'metalsmith';
import path from 'path';
import util from 'util';

import netlifyPublishedDate from '../../src/index';
import { dirpath as fixtures } from '../helpers/fixtures';
import createNetlify from '../helpers/netlify-mock-server';

const test = anyTest as TestInterface<{
    server: ReturnType<typeof createNetlify>;
}>;

test.before(t => {
    t.context.server = createNetlify('example.com');
});

function genMetalsmith(
    options: Parameters<typeof netlifyPublishedDate>[0],
): Metalsmith {
    const metalsmith = Metalsmith(path.join(fixtures, 'basic')).use(
        netlifyPublishedDate({
            ...options,
            siteID: 'example.com',
            cacheDir: null,
        }),
    );
    return metalsmith;
}

async function buildMetalsmith(
    options: Parameters<typeof netlifyPublishedDate>[0],
): Promise<Metalsmith.Files> {
    const metalsmith = genMetalsmith(options);
    const files = await util.promisify(metalsmith.build.bind(metalsmith))();
    return files;
}

test('The default value of the defaultDate option should be generated after plug-in configuration and just before build', async t => {
    await t.context.server;
    const metalsmith = genMetalsmith({});

    const beforeBuild = new Date();
    while (beforeBuild.getTime() !== Date.now());

    const files = await util.promisify(metalsmith.build.bind(metalsmith))();

    const afterBuild = new Date();

    t.true(files['new.html'].published instanceof Date);
    t.true(files['new.html'].published > beforeBuild);
    t.true(files['new.html'].published <= afterBuild);
    t.true(files['new.html'].modified instanceof Date);
    t.true(files['new.html'].modified > beforeBuild);
    t.true(files['new.html'].modified <= afterBuild);
});

test('defaultDate option should accept null', async t => {
    await t.context.server;
    const files = await buildMetalsmith({ defaultDate: null });

    t.true(files['new.html'].published instanceof Date);
    t.true(files['new.html'].modified instanceof Date);
});

test('defaultDate option should accept undefined', async t => {
    await t.context.server;
    const files = await buildMetalsmith({ defaultDate: undefined });

    t.true(files['new.html'].published instanceof Date);
    t.true(files['new.html'].modified instanceof Date);
});

test('defaultDate option should accept Date object', async t => {
    const defaultDate = new Date();

    await t.context.server;
    const files = await buildMetalsmith({ defaultDate });

    t.is(files['new.html'].published, defaultDate);
    t.is(files['new.html'].modified, defaultDate);
});

test('defaultDate option should accept callback function', async t => {
    const defaultDate = new Date();

    await t.context.server;
    const files = await buildMetalsmith({ defaultDate: () => defaultDate });

    t.is(files['new.html'].published, defaultDate);
    t.is(files['new.html'].modified, defaultDate);
});

test('The defaultDate option should accept a callback function that returns non-Date object values', async t => {
    const defaultValue = {};

    await t.context.server;
    const files = await buildMetalsmith({ defaultDate: () => defaultValue });

    t.is(files['new.html'].published, defaultValue);
    t.is(files['new.html'].modified, defaultValue);
});

test('The defaultDate option should accept a callback function that returns primitive value', async t => {
    const defaultValue = 42;

    await t.context.server;
    const files = await buildMetalsmith({ defaultDate: () => defaultValue });

    t.is(files['new.html'].published, defaultValue);
    t.is(files['new.html'].modified, defaultValue);
});

test('The defaultDate option should accept a callback function that returns null', async t => {
    await t.context.server;
    const files = await buildMetalsmith({ defaultDate: () => null });

    t.is(files['new.html'].published, null);
    t.is(files['new.html'].modified, null);
});

test('The defaultDate option should accept a callback function that returns undefined', async t => {
    await t.context.server;
    const files = await buildMetalsmith({ defaultDate: () => undefined });

    t.is(files['new.html'].published, undefined);
    t.is(files['new.html'].modified, undefined);
});
