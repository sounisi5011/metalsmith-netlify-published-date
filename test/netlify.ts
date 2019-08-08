import anyTest, { TestInterface } from 'ava';

import { netlifyDeploys } from '../src/netlify';
import createNetlify from './helpers/netlify-mock-server';
import { deleteProps, iterable2array } from './helpers/utils';

const test = anyTest as TestInterface<{
    server: ReturnType<typeof createNetlify>;
}>;

test.before(t => {
    t.context.server = createNetlify('example.com', [
        { key: 'initial' },
        {},
        {},
        { key: 'target' },
        {},
    ]);
});

test.serial(
    'netlifyDeploys(): If the commitHashList option is undefined, all deploys should be return',
    async t => {
        const server = await t.context.server;

        const logLen = server.requestLogs.api.length;
        const deployList = await iterable2array(
            netlifyDeploys('example.com', {
                commitHashList: undefined,
            }),
        );
        const newLogs = server.requestLogs.api.slice(logLen);

        t.deepEqual(
            deployList.map(deploy =>
                deleteProps(deploy, ['deployAbsoluteURL']),
            ),
            [...server.deploys],
        );
        t.is(newLogs.length, server.apiTotalPages, 'should request all pages');
    },
);

test.serial(
    'netlifyDeploys(): If the commitHashList option is an empty array, it is should return initial deploy only',
    async t => {
        const server = await t.context.server;

        const logLen = server.requestLogs.api.length;
        const deployList = await iterable2array(
            netlifyDeploys('example.com', {
                commitHashList: [],
            }),
        );
        const newLogs = server.requestLogs.api.slice(logLen);

        t.deepEqual(
            deployList.map(deploy =>
                deleteProps(deploy, ['deployAbsoluteURL']),
            ),
            [server.deploys.getByKey('initial')],
        );
        if (server.apiTotalPages === 1) {
            t.is(newLogs.length, 1, 'should only request the first page');
        } else {
            t.is(
                newLogs.length,
                2,
                'should only request the first and last pages',
            );
        }
    },
);

test.serial(
    'netlifyDeploys(): should fetch an API response each time try to get a result',
    async t => {
        const server = await t.context.server;

        const logLen = server.requestLogs.api.length;
        let requestCount = 0;

        const deploys = netlifyDeploys('example.com');
        while (true) {
            const newLogs = server.requestLogs.api.slice(logLen);

            t.is(newLogs.length, requestCount);
            if (newLogs.length !== requestCount) {
                t.log({ newLogs, requestCount });
            }

            const result = await deploys.next();
            if (result.done) {
                break;
            }
            requestCount++;
        }
    },
);

test('netlifyDeploys(): If commit hash is specified in commitHashList option, it is necessary to return two of target deploy and initial deploy', async t => {
    const server = await t.context.server;
    const deploy = server.deploys.getByKey('target');

    const deployList = await iterable2array(
        netlifyDeploys('example.com', {
            commitHashList: [deploy.commit_ref || ''],
        }),
    );

    t.deepEqual(
        deployList.map(deploy => deleteProps(deploy, ['deployAbsoluteURL'])),
        [deploy, server.deploys.getByKey('initial')],
    );
});
