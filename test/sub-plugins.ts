import test from 'ava';
import cloneDeep from 'lodash.clonedeep';
import Metalsmith from 'metalsmith';
import Mustache from 'mustache';
import path from 'path';
import util from 'util';

import netlifyPublishedDate from '../src/index';
import { isObject } from '../src/utils';
import { isFile } from '../src/utils/metalsmith';
import { dirpath as fixtures } from './helpers/fixtures';
import createNetlify, { requestLog2str } from './helpers/netlify-mock-server';
import { deleteProps, entries2obj } from './helpers/utils';

function deleteMetadataProps(
    files: Metalsmith.Files,
    props: readonly string[],
): Metalsmith.Files {
    return entries2obj(
        Object.entries<unknown>(files).map(([prop, value]) => [
            prop,
            isObject(value) ? deleteProps(value, props) : value,
        ]),
    );
}

function processCountPlugin(
    list: ({ clone: Metalsmith.Files; ref: Metalsmith.Files })[],
): Metalsmith.Plugin {
    return (files, metalsmith, done) => {
        list.push({
            clone: cloneDeep(files),
            ref: files,
        });
        done(null, files, metalsmith);
    };
}

function convertMustachePlugin(): Metalsmith.Plugin {
    return (files, metalsmith, done) => {
        Object.entries(files).forEach(([filename, filedata]) => {
            const newFilename = filename.replace(/\.mustache$/, '.html');
            if (newFilename !== filename && isFile(filedata)) {
                try {
                    const output = Mustache.render(
                        filedata.contents.toString(),
                        filedata,
                    );
                    const newFiledata: typeof filedata = {
                        ...filedata,
                        contents: Buffer.from(output),
                    };

                    delete files[filename];
                    files[newFilename] = newFiledata;
                } catch (err) {
                    //
                }
            }
        });
        done(null, files, metalsmith);
    };
}

test('Plugins specified in the "plugins" option should be execute', async t => {
    const siteID = 'template.test';
    const pluginsRunLogs: (Parameters<typeof processCountPlugin>)[0] = [];
    const metalsmith = Metalsmith(path.join(fixtures, 'template')).use(
        netlifyPublishedDate({
            pattern: ['**/*.html', '**/*.mustache'],
            filename2urlPath: filename =>
                filename.replace(/\.mustache$/, '.html'),
            siteID,
            cacheDir: null,
            plugins: [
                convertMustachePlugin(),
                processCountPlugin(pluginsRunLogs),
            ],
        }),
    );
    const server = await createNetlify(
        siteID,
        [
            {
                key: 'initial',
                '/initial.html': { filepath: 'initial.html' },
            },
            {},
            {},
        ],
        { root: metalsmith.source() },
    );

    const initialDeploy = server.deploys.getByKey('initial');

    t.log({
        deploys: Object.assign([...server.deploys], { initialDeploy }),
        previews: new Map(
            [...server.nockScope.previews.entries()].map(([url, scope]) => [
                url,
                scope.activeMocks(),
            ]),
        ),
        requestLogs: server.requestLogs,
    });

    // const lastPublishedDate = new Date(Date.now() - 1);

    const files = await util.promisify(metalsmith.process.bind(metalsmith))();
    const initialPagePreviewLogs = server.requestLogs.previews.filter(
        requestLog => requestLog.path === '/initial.html',
    );
    const requestCountPerPage = server.requestLogs.previews.reduce(
        (requestCountPerPage, requestLog) => {
            const { path } = requestLog;
            requestCountPerPage.set(
                path,
                (requestCountPerPage.get(path) || 0) + 1,
            );
            return requestCountPerPage;
        },
        new Map<string, number>(),
    );

    t.log({
        files,
        requestLogs: {
            previews: server.requestLogs.previews.map(requestLog2str),
            initialPage: initialPagePreviewLogs.map(requestLog2str),
        },
        requestCountPerPage,
        pluginsRunLogs,
    });

    t.deepEqual(
        Object.keys(files),
        ['initial.html', 'new.html'],
        'mustache template files should be converted to html',
    );

    t.deepEqual(
        files['initial.html'].published,
        new Date(initialDeploy.published_at || initialDeploy.created_at),
    );
    t.deepEqual(
        files['initial.html'].modified,
        new Date(initialDeploy.published_at || initialDeploy.created_at),
    );

    // t.true(files['new.html'].published instanceof Date);
    // t.true(files['new.html'].published > lastPublishedDate);
    // t.true(files['new.html'].modified instanceof Date);
    // t.true(files['new.html'].modified > lastPublishedDate);

    t.is(
        initialPagePreviewLogs.length,
        server.deploys.length,
        'If the page was deployed initial, should have requested all the previews',
    );

    /*
     * First, run the plugins with the current time set as metadata. This will get a list of html files to get.
     * If html file exists in the plugins execution result, data will be fetched from API.
     * From the second time on, set the deploy date to metadata and execute the plugins.
     */
    t.is(
        pluginsRunLogs.length,
        Math.max(...requestCountPerPage.values()) + 1,
        'Plugins specified in the "plugins" option should be executed the maximum number of preview requests + 1 times',
    );

    const firstLog = pluginsRunLogs[0];
    pluginsRunLogs.forEach((log, index) => {
        t.deepEqual(
            deleteMetadataProps(log.clone, ['published', 'modified']),
            deleteMetadataProps(firstLog.clone, ['published', 'modified']),
            `Object value in the "files" variable should be the same for each execution of the plugins, except for the "published" and "modified" properties: pluginsRunLogs[0].clone equals pluginsRunLogs[${index}].clone`,
        );
        t.is(
            log.ref,
            firstLog.ref,
            `Object references in the "files" variable should be the same for each execution of the plugins: pluginsRunLogs[0].ref === pluginsRunLogs[${index}].ref`,
        );

        new Set([
            ...Object.keys(firstLog.ref),
            ...Object.keys(log.ref),
        ]).forEach(filename => {
            const escapedFilename = JSON.stringify(filename);
            t.is(
                log.ref[filename],
                firstLog.ref[filename],
                `Object references for each file data in the "files" variable should be the same for each execution of the plugins: pluginsRunLogs[0].ref[${escapedFilename}] === pluginsRunLogs[${index}].ref[${escapedFilename}]`,
            );
        });
    });
});

test('If the plugin gets progressing build of self, make the published date and the modified date of the new file the deploy created date', async t => {
    const siteID = 'progressing-deploy.template.test';
    const pluginsRunLogs: (Parameters<typeof processCountPlugin>)[0] = [];
    const metalsmith = Metalsmith(path.join(fixtures, 'template')).use(
        netlifyPublishedDate({
            pattern: ['**/*.html', '**/*.mustache'],
            filename2urlPath: filename =>
                filename.replace(/\.mustache$/, '.html'),
            siteID,
            cacheDir: null,
            plugins: [
                convertMustachePlugin(),
                processCountPlugin(pluginsRunLogs),
            ],
        }),
    );
    const server = await createNetlify(
        siteID,
        [
            {
                key: 'initial',
                '/initial.html': { filepath: 'initial.html' },
            },
            {},
            {},
            {
                key: 'self-build',
                state: 'building',
            },
            {
                state: 'building',
            },
        ],
        { root: metalsmith.source() },
    );

    const initialDeploy = server.deploys.getByKey('initial');
    const selfDeploy = server.deploys.getByKey('self-build');
    const envs = {
        DEPLOY_ID: selfDeploy.id,
        DEPLOY_URL: `https://${selfDeploy.id}--${selfDeploy.name}.netlify.com`,
    };
    Object.assign(process.env, envs);

    t.log({
        envs,
        deploys: Object.assign([...server.deploys], {
            initialDeploy,
            selfDeploy,
        }),
        previews: new Map(
            [...server.nockScope.previews.entries()].map(([url, scope]) => [
                url,
                scope.activeMocks(),
            ]),
        ),
        requestLogs: server.requestLogs,
    });

    const files = await util.promisify(metalsmith.process.bind(metalsmith))();
    const initialPagePreviewLogs = server.requestLogs.previews.filter(
        requestLog => requestLog.path === '/initial.html',
    );
    const requestCountPerPage = server.requestLogs.previews.reduce(
        (requestCountPerPage, requestLog) => {
            const { path } = requestLog;
            requestCountPerPage.set(
                path,
                (requestCountPerPage.get(path) || 0) + 1,
            );
            return requestCountPerPage;
        },
        new Map<string, number>(),
    );

    t.log({
        files,
        requestLogs: {
            previews: server.requestLogs.previews.map(requestLog2str),
            initialPage: initialPagePreviewLogs.map(requestLog2str),
        },
        requestCountPerPage,
        pluginsRunLogs,
    });

    t.deepEqual(
        Object.keys(files),
        ['initial.html', 'new.html'],
        'mustache template files should be converted to html',
    );

    t.deepEqual(
        files['initial.html'].published,
        new Date(initialDeploy.published_at || initialDeploy.created_at),
    );
    t.deepEqual(
        files['initial.html'].modified,
        new Date(initialDeploy.published_at || initialDeploy.created_at),
    );

    // t.deepEqual(
    //     files['new.html'].published,
    //     new Date(selfDeploy.created_at),
    //     'The published date of the new file should be the created date of the progressing build',
    // );
    // t.deepEqual(
    //     files['new.html'].modified,
    //     new Date(selfDeploy.created_at),
    //     'The modified date of the new file should be the created date of the progressing build',
    // );

    t.is(
        initialPagePreviewLogs.length,
        server.deploys.filter(deploy => deploy.state === 'ready').length,
        'If the page was deployed initial, should have requested all the previews',
    );

    /*
     * First, run the plugins with the current time set as metadata. This will get a list of html files to get.
     * If html file exists in the plugins execution result, data will be fetched from API.
     * From the second time on, set the deploy date to metadata and execute the plugins.
     */
    t.is(
        pluginsRunLogs.length,
        Math.max(...requestCountPerPage.values()) + 1,
        'Plugins specified in the "plugins" option should be executed the maximum number of preview requests + 1 times',
    );

    const firstLog = pluginsRunLogs[0];
    pluginsRunLogs.forEach((log, index) => {
        t.deepEqual(
            deleteMetadataProps(log.clone, ['published', 'modified']),
            deleteMetadataProps(firstLog.clone, ['published', 'modified']),
            `Object value in the "files" variable should be the same for each execution of the plugins, except for the "published" and "modified" properties: pluginsRunLogs[0].clone equals pluginsRunLogs[${index}].clone`,
        );
        t.is(
            log.ref,
            firstLog.ref,
            `Object references in the "files" variable should be the same for each execution of the plugins: pluginsRunLogs[0].ref === pluginsRunLogs[${index}].ref`,
        );

        new Set([
            ...Object.keys(firstLog.ref),
            ...Object.keys(log.ref),
        ]).forEach(filename => {
            const escapedFilename = JSON.stringify(filename);
            t.is(
                log.ref[filename],
                firstLog.ref[filename],
                `Object references for each file data in the "files" variable should be the same for each execution of the plugins: pluginsRunLogs[0].ref[${escapedFilename}] === pluginsRunLogs[${index}].ref[${escapedFilename}]`,
            );
        });
    });
});
