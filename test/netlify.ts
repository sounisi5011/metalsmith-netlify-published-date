import anyTest, { TestInterface } from 'ava';

import { netlifyDeploys } from '../src/netlify';
import createNetlify from './helpers/netlify-mock-server';
import { deleteProps } from './helpers/utils';

const test = anyTest as TestInterface<{
    server: ReturnType<typeof createNetlify>;
}>;

test.before(t => {
    t.context.server = createNetlify('example.com');
});

test.serial(
    'netlifyDeploys(): If the commitHashList option is undefined, all deploys should be return',
    async t => {
        const server = await t.context.server;

        const logLen = server.requestLogs.api.length;
        const deployList = await netlifyDeploys('example.com', {
            commitHashList: undefined,
        });
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
        const deployList = await netlifyDeploys('example.com', {
            commitHashList: [],
        });
        const newLogs = server.requestLogs.api.slice(logLen);

        t.deepEqual(
            deployList.map(deploy =>
                deleteProps(deploy, ['deployAbsoluteURL']),
            ),
            [server.deploys.initial],
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

test('netlifyDeploys(): If commit hash is specified in commitHashList option, it is necessary to return two of target deploy and initial deploy', async t => {
    const server = await t.context.server;
    const deploy =
        server.deploys.find(
            deploy => deploy.commit_ref && deploy !== server.deploys.initial,
        ) || server.deploys.modified;

    const deployList = await netlifyDeploys('example.com', {
        commitHashList: [deploy.commit_ref || ''],
    });

    t.deepEqual(
        deployList.map(deploy => deleteProps(deploy, ['deployAbsoluteURL'])),
        [deploy, server.deploys.initial],
    );
});
