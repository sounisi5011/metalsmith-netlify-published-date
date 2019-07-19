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

test('netlifyDeploys(): If the commitHashList option is undefined, all deploys should be return', async t => {
    const server = await t.context.server;

    const deployList = await netlifyDeploys('example.com', {
        commitHashList: undefined,
    });

    t.deepEqual(
        deployList.map(deploy => deleteProps(deploy, ['deployAbsoluteURL'])),
        [...server.deploys],
    );
});

test('netlifyDeploys(): If the commitHashList option is an empty array, it is should return initial deploy only', async t => {
    const server = await t.context.server;

    const deployList = await netlifyDeploys('example.com', {
        commitHashList: [],
    });

    t.deepEqual(
        deployList.map(deploy => deleteProps(deploy, ['deployAbsoluteURL'])),
        [server.deploys.initial],
    );
});

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
