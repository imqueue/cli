/*!
 * IMQ-CLI command: log
 *
 * I'm Queue Software Project
 * Copyright (C) 2026  imqueue.com <support@imqueue.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * If you want to use this code in a closed source (commercial) project, you can
 * purchase a proprietary commercial license. Please contact us at
 * <support@imqueue.com> to get commercial licensing options.
 */
import {
    createReadStream,
    existsSync,
    readdirSync,
    readFileSync,
    statSync,
    unlinkSync,
    watch,
} from 'fs';
import { basename, join } from 'path';
import { styleText } from 'node:util';
import { type Argv, type Arguments } from 'yargs';
import { VAR_HOME, printError } from '../lib/index.js';

/** Colours cycled through when prefixing multiplexed log lines. */
const COLOURS = ['cyan', 'green', 'yellow', 'magenta', 'blue', 'red'] as const;

/**
 * Resolves the set of log files to read. With explicit service names each
 * `<var>/<name>.log` is returned (missing ones reported to the warn sink);
 * with none, every `*.log` in the runtime directory is returned, sorted.
 *
 * @param {string} varHome - runtime working directory
 * @param {string[]} [services] - explicit service names
 * @param {(msg: string) => void} [warn] - sink for warnings (missing logs)
 * @return {string[]} - absolute log file paths
 */
export function resolveLogFiles(
    varHome: string,
    services?: string[],
    warn: (msg: string) => void = () => undefined,
): string[] {
    if (services && services.length) {
        const files: string[] = [];

        for (const svc of services) {
            const file = join(varHome, `${svc}.log`);

            if (existsSync(file)) {
                files.push(file);
            } else {
                warn(`warn: log-file for service ${svc} has not been found`);
            }
        }

        return files;
    }

    if (!existsSync(varHome)) {
        return [];
    }

    return readdirSync(varHome)
        .filter(f => f.endsWith('.log'))
        .sort()
        .map(f => join(varHome, f));
}

/**
 * Deletes all `*.log` files in the runtime working directory.
 *
 * @param {string} varHome - runtime working directory
 * @return {number} - number of files removed
 */
export function cleanLogs(varHome: string): number {
    if (!existsSync(varHome)) {
        return 0;
    }

    let removed = 0;

    for (const file of readdirSync(varHome)) {
        if (file.endsWith('.log')) {
            unlinkSync(join(varHome, file));
            removed++;
        }
    }

    return removed;
}

/**
 * Prefixes a block of text with a coloured `[service]` label on every line,
 * mirroring the behaviour of tools like `multitail`. When there is a single
 * source the text is returned unchanged.
 *
 * @param {string} label - service name to prefix (already de-suffixed)
 * @param {string} text - the raw text block
 * @param {number} index - source index (drives the colour cycle)
 * @param {boolean} prefix - whether to apply the prefix at all
 * @return {string}
 */
export function labelText(
    label: string,
    text: string,
    index: number,
    prefix: boolean,
): string {
    if (!prefix) {
        return text;
    }

    const tag = styleText(COLOURS[index % COLOURS.length], `[${label}] `);
    const trailingNewline = text.endsWith('\n');
    const lines = (trailingNewline ? text.slice(0, -1) : text).split('\n');

    return (
        lines.map(line => tag + line).join('\n') + (trailingNewline ? '\n' : '')
    );
}

/**
 * Reads and optionally follows a set of log files, writing their (labelled)
 * contents to the output sink. With `follow: false` it dumps current contents
 * and resolves immediately - the mode used by tests and one-shot reads. With
 * `follow: true` it additionally streams appended data until the process is
 * interrupted.
 *
 * @param {string[]} files - log file paths
 * @param {object} opts - behaviour flags
 * @param {boolean} opts.follow - keep streaming appended data
 * @param {boolean} opts.prefix - prefix each line with the service name
 * @param {(chunk: string) => void} [opts.out] - output sink (default: stdout)
 * @return {Promise<void>} - resolves when done (never, while following)
 */
export function tailFiles(
    files: string[],
    opts: { follow: boolean; prefix: boolean; out?: (chunk: string) => void },
): Promise<void> {
    const out = opts.out || ((chunk: string) => process.stdout.write(chunk));
    const labels = files.map(f => basename(f).replace(/\.log$/, ''));

    // dump the current contents of every file first (tail -f -n +1)
    files.forEach((file, i) => {
        try {
            const text = readFileSync(file, 'utf8');

            if (text) {
                out(labelText(labels[i], text, i, opts.prefix));
            }
        } catch {
            /* unreadable - skip */
        }
    });

    if (!opts.follow) {
        return Promise.resolve();
    }

    // then follow appended bytes on each file, forever
    return new Promise<void>(() => {
        files.forEach((file, i) => {
            let position = safeSize(file);

            watch(file, { persistent: true }, eventType => {
                if (eventType !== 'change') {
                    return;
                }

                const size = safeSize(file);

                if (size < position) {
                    // file was truncated/rotated - start over
                    position = 0;
                }

                if (size > position) {
                    const stream = createReadStream(file, {
                        start: position,
                        end: size - 1,
                        encoding: 'utf8',
                    });

                    position = size;
                    stream.on('data', chunk =>
                        out(
                            labelText(labels[i], String(chunk), i, opts.prefix),
                        ),
                    );
                    stream.on('error', () => undefined);
                }
            });
        });
    });
}

/**
 * Returns a file's size in bytes, or 0 when it cannot be stat-ed.
 *
 * @param {string} file
 * @return {number}
 */
function safeSize(file: string): number {
    try {
        return statSync(file).size;
    } catch {
        return 0;
    }
}

export const { command, describe, builder, handler } = {
    command: 'log [services..]',
    describe:
        'Tails and combines logs of IMQ services started with `imq ctl`. ' +
        'With no service names, all available logs are combined.',

    builder(yargs: Argv) {
        return yargs
            .positional('services', {
                describe:
                    'Service (repository) names to combine logs for. If ' +
                    'omitted, all existing logs are combined.',
                type: 'string',
                array: true,
            })
            .option('c', {
                alias: 'clean',
                default: false,
                describe: 'Delete previously collected logs and exit.',
                type: 'boolean',
            })
            .option('f', {
                alias: 'follow',
                default: true,
                describe:
                    'Keep the output stream open and follow appended log ' +
                    'data. Use --no-follow to dump current logs and exit.',
                type: 'boolean',
            })
            .option('P', {
                alias: 'no-prefix',
                default: false,
                describe: 'Do not prefix log lines with the service name.',
                type: 'boolean',
            });
    },

    async handler(argv: Arguments) {
        try {
            const varHome = VAR_HOME;

            if (argv.clean) {
                const n = cleanLogs(varHome);

                process.stdout.write(
                    styleText('green', `Removed ${n} log file(s).\n`),
                );

                return;
            }

            const services = (argv.services as string[] | undefined)?.filter(
                Boolean,
            );
            const files = resolveLogFiles(varHome, services, msg =>
                process.stderr.write(styleText('yellow', msg + '\n')),
            );

            if (!files.length) {
                process.stdout.write('No service logs found.\n');

                return;
            }

            await tailFiles(files, {
                follow: argv.follow !== false,
                prefix: !argv.noPrefix && files.length > 1,
            });
        } catch (err) {
            printError(err as Error);
        }
    },
};
