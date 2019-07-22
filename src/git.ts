import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface CommitInterface {
    readonly hash: string;
    readonly authorDate: Date;
    readonly commitDate: Date;
}

export async function getFirstParentCommits(): Promise<
    readonly CommitInterface[]
> {
    const { stdout } = await execFileAsync('git', [
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
