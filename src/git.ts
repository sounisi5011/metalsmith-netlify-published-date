import { execFile } from 'child_process';
import { promisify } from 'util';

import { debug } from './utils/log';

const log = debug.extend('git');
const errorLog = log.extend('error');

const execFileAsync = promisify(execFile);

export interface CommitInterface {
    readonly hash: string;
    readonly authorDate: Date;
    readonly commitDate: Date;
}

export async function exec(
    args: string[],
): Promise<{ stdout: string; stderr: string }> {
    const cmd = 'git';
    log(
        `Exec the Git command: ${[cmd, ...args]
            .map(arg => (/\s/.test(arg) ? '%o' : '%s'))
            .join(' ')}`,
        cmd,
        ...args,
    );
    try {
        const ret = await execFileAsync(cmd, args);
        log('Git command execution success');
        return ret;
    } catch (error) {
        errorLog('Git command execute failed: %O', error);
        throw error;
    }
}

export async function getFirstParentCommits(): Promise<
    readonly CommitInterface[]
> {
    const { stdout } = await exec([
        'log',
        '--first-parent',
        '--format=%H %at %ct',
    ]);
    return stdout
        .split(/[\r\n]+/)
        .filter(line => /^[0-9a-f]+ [0-9]+ [0-9]+$/i.test(line))
        .map(line => {
            const [hash, authorDateUnixtime, commitDateUnixtime] = line.split(
                / +/,
            );
            return {
                hash,
                authorDate: new Date(Number(authorDateUnixtime) * 1000),
                commitDate: new Date(Number(commitDateUnixtime) * 1000),
            };
        });
}
