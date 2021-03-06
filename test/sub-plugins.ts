import test from 'ava';
import Metalsmith from 'metalsmith';
import path from 'path';

import netlifyPublishedDate from '../src/index';
import { isObject } from '../src/utils';
import { dirpath as fixtures } from './helpers/fixtures';
import { processAsync } from './helpers/metalsmith';
import createNetlify from './helpers/netlify-mock-server';
import { convertMustachePlugin, processCountPlugin } from './helpers/plugins';
import { deleteProps, entries2obj } from './helpers/utils';

function replaceMetadataPropsValue(
    files: Metalsmith.Files,
    props: readonly string[],
    value: unknown,
): Metalsmith.Files {
    return entries2obj(
        Object.entries<unknown>(files).map(([filename, filedata]) => {
            if (isObject(filedata)) {
                props.forEach(prop => {
                    if (prop in filedata) {
                        filedata[prop] = value;
                    }
                });
            }
            return [filename, filedata];
        }),
    );
}

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

test('Plugins specified in the "plugins" option should be execute', async t => {
    const siteID = 'template.test';
    const beforeFilesList: Parameters<typeof processCountPlugin>[0] = [];
    const pluginsRunLogs: Parameters<typeof processCountPlugin>[0] = [];
    const metalsmith = Metalsmith(path.join(fixtures, 'template'))
        .use(processCountPlugin(beforeFilesList))
        .use(
            netlifyPublishedDate({
                pattern: ['**/*.html', '**/*.mustache'],
                filename2urlPath: filename =>
                    filename.replace(/\.mustache$/, '.html'),
                siteID,
                cacheDir: null,
                plugins: [
                    processCountPlugin(pluginsRunLogs),
                    convertMustachePlugin(),
                ],
            }),
        );
    const server = await createNetlify(
        siteID,
        [
            {
                key: 'initial',
                '/initial.html': { filepath: 'initial.mustache' },
                '/modified.html': Buffer.from(''),
            },
            {},
            {
                key: 'added',
                '/added.html': { filepath: 'added.mustache' },
                '/add-modified.html': '',
            },
            {},
            {
                key: 'modified',
                '/modified.html': { filepath: 'modified.mustache' },
                '/add-modified.html': { filepath: 'add-modified.mustache' },
            },
            {},
            {},
        ],
        { root: metalsmith.source() },
    );

    const initialDeploy = server.deploys.getByKey('initial');
    const addedDeploy = server.deploys.getByKey('added');
    const modifiedDeploy = server.deploys.getByKey('modified');

    t.log({
        deploys: Object.assign([...server.deploys], {
            initialDeploy,
            addedDeploy,
            modifiedDeploy,
        }),
        previews: new Map(
            [...server.nockScope.previews.entries()].map(([url, scope]) => [
                url,
                scope.activeMocks(),
            ]),
        ),
        requestLogs: server.requestLogs,
    });

    const beforeBuildDate = new Date(Date.now() - 1);

    const files = await processAsync(metalsmith);
    const beforeFiles = beforeFilesList[0];
    const initialPagePreviewLogs = server.requestLogs.previews.filter(
        requestLog => requestLog.path === '/initial.html',
    );
    const modifiedPagePreviewLogs = server.requestLogs.previews.filter(
        requestLog => requestLog.path === '/modified.html',
    );
    const addedPagePreviewLogs = server.requestLogs.previews.filter(
        requestLog => requestLog.path === '/added.html',
    );
    const addModifiedPagePreviewLogs = server.requestLogs.previews.filter(
        requestLog => requestLog.path === '/add-modified.html',
    );
    const newPagePreviewLogs = server.requestLogs.previews.filter(
        requestLog => requestLog.path === '/new.html',
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
        requestLogs: Object.assign(server.requestLogs.previews.map(String), {
            initialPage: initialPagePreviewLogs.map(String),
            modifiedPage: modifiedPagePreviewLogs.map(String),
            addedPage: addedPagePreviewLogs.map(String),
            addModifiedPage: addModifiedPagePreviewLogs.map(String),
            newPage: newPagePreviewLogs.map(String),
        }),
        requestCountPerPage,
        beforeFiles,
        pluginsRunLogs,
    });

    t.deepEqual(
        Object.keys(files).sort(),
        [
            'initial.html',
            'added.html',
            'add-modified.html',
            'modified.html',
            'new.html',
        ].sort(),
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

    t.deepEqual(
        files['added.html'].published,
        new Date(addedDeploy.published_at || addedDeploy.created_at),
    );
    t.deepEqual(
        files['added.html'].modified,
        new Date(addedDeploy.published_at || addedDeploy.created_at),
    );

    t.deepEqual(
        files['modified.html'].published,
        new Date(initialDeploy.published_at || initialDeploy.created_at),
    );
    t.deepEqual(
        files['modified.html'].modified,
        new Date(modifiedDeploy.published_at || modifiedDeploy.created_at),
    );

    t.deepEqual(
        files['add-modified.html'].published,
        new Date(addedDeploy.published_at || addedDeploy.created_at),
    );
    t.deepEqual(
        files['add-modified.html'].modified,
        new Date(modifiedDeploy.published_at || modifiedDeploy.created_at),
    );

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

    const lastLog = pluginsRunLogs[pluginsRunLogs.length - 1];
    pluginsRunLogs.forEach((log, index) => {
        t.deepEqual(
            deleteMetadataProps(log.clone, ['published', 'modified']),
            deleteMetadataProps(beforeFiles.clone, ['published', 'modified']),
            `Object value in the "files" variable should be the same for each execution of the plugins, except for the "published" and "modified" properties: beforeFiles.clone equals pluginsRunLogs[${index}].clone`,
        );
        t.deepEqual(
            replaceMetadataPropsValue(
                log.clone,
                ['published', 'modified'],
                '[ value replaced by test ]',
            ),
            replaceMetadataPropsValue(
                lastLog.clone,
                ['published', 'modified'],
                '[ value replaced by test ]',
            ),
            `Object value in the "files" variable should be the same for each execution of the plugins, except for the "published" and "modified" properties value difference: pluginsRunLogs[{last index}].clone equals pluginsRunLogs[${index}].clone`,
        );
        t.is(
            log.ref,
            beforeFiles.ref,
            `Object references in the "files" variable should be the same for each execution of the plugins: beforeFiles.ref === pluginsRunLogs[${index}].ref`,
        );

        new Set([
            ...Object.keys(beforeFiles.ref),
            ...Object.keys(log.ref),
        ]).forEach(filename => {
            const escapedFilename = JSON.stringify(filename);
            t.is(
                log.ref[filename],
                beforeFiles.ref[filename],
                `Object references for each file data in the "files" variable should be the same for each execution of the plugins: beforeFiles.ref[${escapedFilename}] === pluginsRunLogs[${index}].ref[${escapedFilename}]`,
            );
        });
    });
});

test('If the plugin gets progressing build of self, make the published date and the modified date of the new file the deploy created date', async t => {
    const siteID = 'progressing-deploy.template.test';
    const beforeFilesList: Parameters<typeof processCountPlugin>[0] = [];
    const pluginsRunLogs: Parameters<typeof processCountPlugin>[0] = [];
    const metalsmith = Metalsmith(path.join(fixtures, 'template'))
        .use(processCountPlugin(beforeFilesList))
        .use(
            netlifyPublishedDate({
                pattern: ['**/*.html', '**/*.mustache'],
                filename2urlPath: filename =>
                    filename.replace(/\.mustache$/, '.html'),
                siteID,
                cacheDir: null,
                plugins: [
                    processCountPlugin(pluginsRunLogs),
                    convertMustachePlugin(),
                ],
            }),
        );
    const server = await createNetlify(
        siteID,
        [
            {
                key: 'initial',
                '/initial.html': { filepath: 'initial.mustache' },
            },
            {},
            {},
            {
                key: 'self-build',
                state: 'building',
            },
            {},
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

    const files = await processAsync(metalsmith);
    const beforeFiles = beforeFilesList[0];
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
        requestLogs: Object.assign(server.requestLogs.previews.map(String), {
            initialPage: initialPagePreviewLogs.map(String),
        }),
        requestCountPerPage,
        pluginsRunLogs,
    });

    t.deepEqual(
        Object.keys(files).sort(),
        [
            'initial.html',
            'added.html',
            'add-modified.html',
            'modified.html',
            'new.html',
        ].sort(),
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

    const lastLog = pluginsRunLogs[pluginsRunLogs.length - 1];
    pluginsRunLogs.forEach((log, index) => {
        t.deepEqual(
            deleteMetadataProps(log.clone, ['published', 'modified']),
            deleteMetadataProps(beforeFiles.clone, ['published', 'modified']),
            `Object value in the "files" variable should be the same for each execution of the plugins, except for the "published" and "modified" properties: beforeFiles.clone equals pluginsRunLogs[${index}].clone`,
        );
        t.deepEqual(
            replaceMetadataPropsValue(
                log.clone,
                ['published', 'modified'],
                '[ value replaced by test ]',
            ),
            replaceMetadataPropsValue(
                lastLog.clone,
                ['published', 'modified'],
                '[ value replaced by test ]',
            ),
            `Object value in the "files" variable should be the same for each execution of the plugins, except for the "published" and "modified" properties value difference: pluginsRunLogs[{last index}].clone equals pluginsRunLogs[${index}].clone`,
        );
        t.is(
            log.ref,
            beforeFiles.ref,
            `Object references in the "files" variable should be the same for each execution of the plugins: beforeFiles.ref === pluginsRunLogs[${index}].ref`,
        );

        new Set([
            ...Object.keys(beforeFiles.ref),
            ...Object.keys(log.ref),
        ]).forEach(filename => {
            const escapedFilename = JSON.stringify(filename);
            t.is(
                log.ref[filename],
                beforeFiles.ref[filename],
                `Object references for each file data in the "files" variable should be the same for each execution of the plugins: beforeFiles.ref[${escapedFilename}] === pluginsRunLogs[${index}].ref[${escapedFilename}]`,
            );
        });
    });
});
