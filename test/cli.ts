import test from 'ava';
import path from 'path';

import exec from './helpers/exec';
import { dirpath as fixtures } from './helpers/fixtures';
import { fileExists } from './helpers/utils';

const PROJECT_ROOT = path.resolve(__dirname, '..');

test.before(async () => {
    if (!(await fileExists(PROJECT_ROOT, 'dist', 'index.js'))) {
        await exec(['npm', 'run', 'build'], {
            cwd: PROJECT_ROOT,
        });
    }
});

test('should work with Metalsmith CLI', async t => {
    await t.notThrowsAsync(
        exec(
            [path.resolve(PROJECT_ROOT, 'node_modules', '.bin', 'metalsmith')],
            {
                cwd: path.join(fixtures, 'cli'),
            },
        ),
    );
});
