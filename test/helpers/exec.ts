import childProcess from 'child_process';

export default function(
    [command, ...args]: readonly string[],
    options?: childProcess.ExecFileOptions,
): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        const process = childProcess.execFile(command, args, options);
        const stdoutList: unknown[] = [];
        const stderrList: unknown[] = [];

        if (process.stdout) {
            process.stdout.on('data', chunk => {
                stdoutList.push(chunk);
            });
        }

        if (process.stderr) {
            process.stderr.on('data', chunk => {
                stderrList.push(chunk);
            });
        }

        process.on('close', (code, signal) => {
            const stdout = stdoutList.join('');
            const stderr = stderrList.join('');

            if (code === 0) {
                resolve({ stdout, stderr });
            } else {
                const err = new Error(
                    [
                        `Command failed code=${code} signal=${signal}`,
                        '',
                        'stdout:',
                        stdout.replace(/^|\r\n?|\n/g, '$&o '),
                        '',
                        'stderr:',
                        stderr.replace(/^|\r\n?|\n/g, '$&e '),
                    ].join('\n'),
                );
                Object.assign(err, {
                    name: 'CommandFailedError',
                    code,
                    cmd: [command, ...args],
                    options,
                });
                reject(err);
            }
        });

        process.on('error', err => {
            reject(err);
        });
    });
}
