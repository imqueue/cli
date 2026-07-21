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
    type FSWatcher,
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
import { VAR_HOME, parseServices, printError } from '../lib/index.js';

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
 * Deletes collected log files in the runtime working directory. With an
 * explicit list of service names, only `<name>.log` for those services is
 * removed; with none, every `*.log` is removed.
 *
 * @param {string} varHome - runtime working directory
 * @param {string[]} [services] - service names to scope the clean to
 * @return {number} - number of files removed
 */
export function cleanLogs(varHome: string, services?: string[]): number {
    if (!existsSync(varHome)) {
        return 0;
    }

    const scoped = services && services.length ? new Set(services) : undefined;
    let removed = 0;

    for (const file of readdirSync(varHome)) {
        if (!file.endsWith('.log')) {
            continue;
        }

        if (scoped && !scoped.has(file.replace(/\.log$/, ''))) {
            continue;
        }

        unlinkSync(join(varHome, file));
        removed++;
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
    opts: {
        follow: boolean;
        prefix: boolean;
        out?: (chunk: string) => void;
        // aborting stops follow mode and cleans up watchers/timers; production
        // never aborts (follow runs until the process is killed), but tests use
        // it to end a follow deterministically
        signal?: AbortSignal;
    },
): Promise<void> {
    const out = opts.out || ((chunk: string) => process.stdout.write(chunk));
    const labels = files.map(f => basename(f).replace(/\.log$/, ''));

    // capture each file's size BEFORE dumping, so bytes appended during the
    // dump are picked up by the follower rather than lost in the gap
    const positions = files.map(f => safeSize(f));

    // dump the current contents of every file first (tail -f -n +1), bounded
    // to the captured size
    files.forEach((file, i) => {
        try {
            const buf = readFileSync(file);
            const text = buf.subarray(0, positions[i]).toString('utf8');

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
    return new Promise<void>(resolve => {
        // A ref'd timer keeps the event loop alive for the whole lifetime of
        // follow mode. Without it, a moment when no fs.watch handle is active
        // (e.g. the gap while re-watching a rotated file) would let Node drain
        // its loop and exit 0 mid-follow. `imq log -f` runs until interrupted.
        const keepAlive = setInterval(() => undefined, 1 << 30);

        const stops = files.map((file, i) =>
            followFile(file, labels[i], i, positions[i], out, opts.prefix),
        );

        opts.signal?.addEventListener('abort', () => {
            clearInterval(keepAlive);

            for (const stop of stops) {
                stop();
            }

            resolve();
        });
    });
}

/** Delay before re-watching a rotated/absent log file (ms). */
const REWATCH_DELAY_MS = 100;

/**
 * Follows one log file, emitting appended data as whole labelled lines. Data is
 * buffered at the byte level and only decoded up to the last newline, so a
 * `[svc]` tag is never injected mid-line AND a multibyte character split across
 * two writes is never mangled into replacement characters. Survives
 * truncation and rotation (re-watching until the file reappears, then draining
 * from the top) and never crashes the process on watcher errors.
 *
 * @param {string} file - log file path
 * @param {string} label - service name for the prefix
 * @param {number} index - source index (colour cycle)
 * @param {number} startPos - byte offset to start following from
 * @param {(chunk: string) => void} out - output sink
 * @param {boolean} prefix - whether to prefix lines
 * @return {() => void} - a cleanup function that stops following this file
 */
function followFile(
    file: string,
    label: string,
    index: number,
    startPos: number,
    out: (chunk: string) => void,
    prefix: boolean,
): () => void {
    let position = startPos;
    let watcher: FSWatcher | undefined;
    let rewatchTimer: ReturnType<typeof setTimeout> | undefined;
    // hold undecoded bytes (a partial line and/or a partial multibyte char)
    // until a newline arrives - decoding whole lines keeps UTF-8 intact
    let pending = Buffer.alloc(0);

    const drain = () => {
        const size = safeSize(file);

        if (size < position) {
            // truncated in place - start over from the top
            position = 0;
            pending = Buffer.alloc(0);
        }

        if (size <= position) {
            return;
        }

        let data: Buffer;

        try {
            data = readFileSync(file).subarray(position, size);
        } catch {
            return; // transient read error - retry on the next event
        }

        position = size;
        pending = Buffer.concat([pending, data]);

        // emit up to (and including) the last newline; keep the remainder
        // buffered - never decode a boundary that could split a UTF-8 sequence
        const nl = pending.lastIndexOf(0x0a);

        if (nl >= 0) {
            const text = pending.subarray(0, nl + 1).toString('utf8');

            pending = pending.subarray(nl + 1);
            out(labelText(label, text, index, prefix));
        }
    };

    const start = () => {
        try {
            const w = watch(file, { persistent: true }, eventType => {
                if (eventType === 'rename') {
                    // the file was moved/replaced (log rotation) - rebind to
                    // the path and read the new file from the top
                    try {
                        w.close();
                    } catch {
                        /* ignore */
                    }

                    position = 0;
                    pending = Buffer.alloc(0);
                    rewatch();

                    return;
                }

                drain();
            });

            watcher = w;

            // a watcher 'error' event is otherwise fatal (unhandled) - rebind
            w.on('error', () => {
                try {
                    w.close();
                } catch {
                    /* ignore */
                }

                rewatch();
            });
        } catch {
            // the file is not present yet - keep retrying until it reappears
            rewatch();
        }
    };

    const rewatch = () => {
        rewatchTimer = setTimeout(() => {
            if (existsSync(file)) {
                start();
                // pick up anything written before the watch was (re)established
                drain();
            } else {
                rewatch();
            }
        }, REWATCH_DELAY_MS);
    };

    start();

    return () => {
        try {
            watcher?.close();
        } catch {
            /* ignore */
        }

        if (rewatchTimer) {
            clearTimeout(rewatchTimer);
        }
    };
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
            .option('prefix', {
                default: true,
                describe:
                    'Prefix each combined log line with the service name ' +
                    '(applies when more than one log is shown). ' +
                    'Use --no-prefix to disable.',
                type: 'boolean',
            })
            .option('P', {
                // short, hidden alias for --no-prefix: yargs cannot invert an
                // alias, so this is a separate flag combined in the handler
                default: false,
                describe: 'Shorthand for --no-prefix.',
                type: 'boolean',
                hidden: true,
            });
    },

    async handler(argv: Arguments) {
        try {
            const varHome = VAR_HOME;
            const services = parseServices(argv.services);

            if (argv.clean) {
                const n = cleanLogs(varHome, services);
                const scope =
                    services && services.length
                        ? ` for ${services.join(', ')}`
                        : '';

                process.stdout.write(
                    styleText('green', `Removed ${n} log file(s)${scope}.\n`),
                );

                return;
            }

            const files = resolveLogFiles(varHome, services, msg =>
                process.stderr.write(styleText('yellow', msg + '\n')),
            );

            if (!files.length) {
                process.stdout.write('No service logs found.\n');

                return;
            }

            const prefix =
                argv.prefix !== false && argv.P !== true && files.length > 1;

            await tailFiles(files, {
                follow: argv.follow !== false,
                prefix,
            });
        } catch (err) {
            printError(err as Error);
        }
    },
};
