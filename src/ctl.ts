/*!
 * IMQ-CLI command: ctl
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
import { spawn, spawnSync } from 'child_process';
import {
    existsSync,
    mkdirSync,
    openSync,
    readFileSync,
    writeFileSync,
} from 'fs';
import { join } from 'path';
import { styleText } from 'node:util';
import { type Argv, type Arguments } from 'yargs';
import { VAR_HOME, discoverServices, printError } from '../lib/index.js';

/** Log line emitted by a healthy service once its IMQ reader channel is up. */
const READY_MARKER = 'reader channel connected';
/** Log line emitted when a service crashed during startup. */
const ERROR_MARKER = 'UnhandledPromiseRejectionWarning:';
/** How many one-second polls to wait for readiness in calm mode. */
const MAX_READY_ATTEMPTS = 60;

/**
 * Side-effectful primitives used by the ctl orchestration. Extracted behind an
 * interface so the control flow can be unit-tested with fakes while the real
 * command wires in process spawning, git and the filesystem.
 */
export interface CtlDeps {
    /** Starts `npm run dev` for a service, piping output to logFile; pid. */
    startService(dir: string, logFile: string): number;
    /** Runs `git pull` in the service directory. */
    gitPull(dir: string): void;
    /** Runs `npm run stop` in the service directory (best-effort). */
    stopService(dir: string): void;
    /** Terminates a started process (and its group) by pid. */
    killGroup(pid: number): void;
    /** Reads a service log file, returning '' when it does not exist yet. */
    readLog(logFile: string): string;
    /** Resolves after the given number of milliseconds. */
    sleep(ms: number): Promise<void>;
    /** Monotonic-ish millisecond clock (injected so tests stay deterministic). */
    now(): number;
    /** Writes a status line for the user. */
    log(msg: string): void;
}

/** Options controlling a ctl invocation. */
export interface CtlOptions {
    path: string;
    services?: string[];
    update: boolean;
    calm: boolean;
    verbose: boolean;
    varHome?: string;
}

/** Outcome of waiting for a service to become ready in calm mode. */
export type ReadyState = 'ready' | 'errored' | 'timeout';

interface PidEntry {
    svc: string;
    pid: number;
}

/**
 * Parses the `<var>/.pids` file into `{ svc, pid }` records, ignoring blank or
 * malformed lines. Missing file yields an empty list.
 *
 * @param {string} varHome - runtime working directory
 * @return {PidEntry[]}
 */
export function readPids(varHome: string): PidEntry[] {
    const file = join(varHome, '.pids');

    if (!existsSync(file)) {
        return [];
    }

    const entries: PidEntry[] = [];

    for (const line of readFileSync(file, 'utf8').split('\n')) {
        const trimmed = line.trim();

        if (!trimmed) {
            continue;
        }

        const idx = trimmed.lastIndexOf(':');
        const svc = trimmed.slice(0, idx);
        const pid = Number(trimmed.slice(idx + 1));

        if (idx > 0 && Number.isInteger(pid) && pid > 0) {
            entries.push({ svc, pid });
        }
    }

    return entries;
}

/**
 * Serialises pid records back to the `<var>/.pids` file (one `svc:pid` per
 * line). Writing an empty list removes the file's contents.
 *
 * @param {string} varHome - runtime working directory
 * @param {PidEntry[]} entries - records to persist
 */
export function writePids(varHome: string, entries: PidEntry[]): void {
    const body = entries.map(e => `${e.svc}:${e.pid}`).join('\n');

    writeFileSync(join(varHome, '.pids'), body ? body + '\n' : '');
}

/**
 * Polls a service log file until it reports readiness, reports a startup
 * error, or the attempt budget is exhausted. Used by calm mode so services
 * start one-at-a-time rather than all at once.
 *
 * @param {string} logFile - path to the service log
 * @param {CtlDeps} deps - injected primitives
 * @param {number} [maxAttempts] - number of one-second polls before timing out
 * @return {Promise<ReadyState>}
 */
export async function waitForReady(
    logFile: string,
    deps: CtlDeps,
    maxAttempts: number = MAX_READY_ATTEMPTS,
): Promise<ReadyState> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const log = deps.readLog(logFile);

        if (log.includes(READY_MARKER)) {
            return 'ready';
        }

        if (log.includes(ERROR_MARKER)) {
            return 'errored';
        }

        await deps.sleep(1000);
    }

    return 'timeout';
}

/**
 * Ensures the runtime working directory exists and returns it.
 *
 * @param {CtlOptions} opts
 * @return {string}
 */
function ensureVarHome(opts: CtlOptions): string {
    const varHome = opts.varHome || VAR_HOME;

    mkdirSync(varHome, { recursive: true });

    return varHome;
}

/**
 * Starts the selected services, recording their master pids and (in calm
 * mode) waiting for each to become ready before starting the next.
 *
 * @param {CtlOptions} opts
 * @param {CtlDeps} deps
 * @return {Promise<void>}
 */
export async function startServices(
    opts: CtlOptions,
    deps: CtlDeps,
): Promise<void> {
    const services = discoverServices(opts.path, opts.services);

    if (!services.length) {
        deps.log('No IMQ services found to start.');

        return;
    }

    const varHome = ensureVarHome(opts);
    // keep pids of services we are not (re)starting; index by name so a
    // restarted service replaces its stale pid rather than duplicating it
    const pids = new Map<string, number>();

    for (const { svc, pid } of readPids(varHome)) {
        pids.set(svc, pid);
    }

    for (const svc of services) {
        const dir = join(opts.path, svc);

        if (!existsSync(dir)) {
            deps.log(styleText('red', `No such service directory: ${dir}`));

            continue;
        }

        if (opts.update) {
            deps.log(`Updating ${svc}...`);
            deps.gitPull(dir);
        }

        const logFile = join(varHome, `${svc}.log`);
        const pid = deps.startService(dir, logFile);

        pids.set(svc, pid);
        deps.log(`Starting ${svc}, master pid is ${pid}...`);

        if (opts.calm) {
            const state = await waitForReady(logFile, deps);

            if (state === 'errored') {
                deps.log(
                    styleText(
                        'yellow',
                        `warn: service ${svc} errored, ` +
                            'please, consider watching logs...',
                    ),
                );
            } else if (state === 'timeout') {
                deps.log(
                    styleText(
                        'yellow',
                        `warn: timed out waiting for ${svc} to become ` +
                            'ready, moving on...',
                    ),
                );
            }
        }
    }

    writePids(
        varHome,
        [...pids].map(([svc, pid]) => ({ svc, pid })),
    );

    if (!opts.calm) {
        deps.log('Bulk service start initiated, please, be patient...');
    }
}

/**
 * Stops the selected services: kills their recorded master processes (keeping
 * unrelated pids in the pid file) and runs each service's `stop` script.
 *
 * @param {CtlOptions} opts
 * @param {CtlDeps} deps
 * @return {void}
 */
export function stopServices(opts: CtlOptions, deps: CtlDeps): void {
    const varHome = ensureVarHome(opts);
    const services = discoverServices(opts.path, opts.services);
    const target = new Set(services);
    const remaining: PidEntry[] = [];

    for (const entry of readPids(varHome)) {
        if (target.has(entry.svc)) {
            deps.log(`Stopping ${entry.svc} (pid ${entry.pid})...`);
            deps.killGroup(entry.pid);
        } else {
            remaining.push(entry);
        }
    }

    writePids(varHome, remaining);

    for (const svc of services) {
        const dir = join(opts.path, svc);

        if (existsSync(dir)) {
            deps.stopService(dir);
        }
    }
}

/**
 * Runs a ctl action (start | stop | restart) end-to-end, honoring verbose
 * timing.
 *
 * @param {'start'|'stop'|'restart'} action
 * @param {CtlOptions} opts
 * @param {CtlDeps} deps
 * @return {Promise<void>}
 */
export async function runCtl(
    action: 'start' | 'stop' | 'restart',
    opts: CtlOptions,
    deps: CtlDeps,
): Promise<void> {
    const started = deps.now();

    if (action === 'stop' || action === 'restart') {
        stopServices(opts, deps);
    }

    if (action === 'start' || action === 'restart') {
        await startServices(opts, deps);
    }

    if (opts.verbose) {
        deps.log(
            `Command 'ctl ${action}' executed in ` +
                `${Math.round((deps.now() - started) / 1000)} sec.`,
        );
    }
}

/**
 * Builds the production dependency set (real spawning, git and filesystem).
 *
 * @return {CtlDeps}
 */
export function defaultDeps(): CtlDeps {
    return {
        startService(dir: string, logFile: string): number {
            const out = openSync(logFile, 'a');
            const child = spawn('npm', ['run', '--silent', 'dev'], {
                cwd: dir,
                detached: true,
                stdio: ['ignore', out, out],
            });

            child.unref();

            return child.pid ?? 0;
        },
        gitPull(dir: string): void {
            spawnSync('git', ['pull'], { cwd: dir, stdio: 'inherit' });
        },
        stopService(dir: string): void {
            // best-effort: services without a `stop` script simply no-op
            spawnSync('npm', ['run', '--silent', 'stop'], {
                cwd: dir,
                stdio: 'ignore',
            });
        },
        killGroup(pid: number): void {
            try {
                // detached children lead their own process group (pgid = pid),
                // so a negative pid signals the whole tree
                process.kill(-pid, 'SIGTERM');
            } catch {
                try {
                    process.kill(pid, 'SIGTERM');
                } catch {
                    /* already gone */
                }
            }
        },
        readLog(logFile: string): string {
            try {
                return readFileSync(logFile, 'utf8');
            } catch {
                return '';
            }
        },
        sleep(ms: number): Promise<void> {
            return new Promise(res => setTimeout(res, ms));
        },
        now(): number {
            return Date.now();
        },
        log(msg: string): void {
            process.stdout.write(msg + '\n');
        },
    };
}

export const { command, describe, builder, handler } = {
    command: 'ctl <action>',
    describe:
        'Controls a bulk of IMQ services (start, stop or restart) located ' +
        'under a given path.',

    builder(yargs: Argv) {
        return yargs
            .positional('action', {
                describe: 'Action to perform on the services.',
                choices: ['start', 'stop', 'restart'] as const,
                type: 'string',
            })
            .option('p', {
                alias: 'path',
                default: '.',
                describe:
                    'Path to a directory with service repositories ' +
                    '(default: current directory).',
                type: 'string',
            })
            .option('s', {
                alias: 'services',
                describe:
                    'Comma-separated list of service (repository) names. ' +
                    'If omitted, the path is scanned for services.',
                type: 'string',
            })
            .option('u', {
                alias: 'update',
                default: false,
                describe: "Run 'git pull' on each service before starting.",
                type: 'boolean',
            })
            .option('c', {
                alias: 'calm',
                default: false,
                describe:
                    'Calm start - wait for each service to become ready ' +
                    'before starting the next.',
                type: 'boolean',
            })
            .option('v', {
                alias: 'verbose',
                default: false,
                describe: 'Verbose mode - show command execution time.',
                type: 'boolean',
            });
    },

    async handler(argv: Arguments) {
        try {
            const services =
                typeof argv.services === 'string'
                    ? (argv.services as string).split(',')
                    : undefined;

            await runCtl(
                argv.action as 'start' | 'stop' | 'restart',
                {
                    path: argv.path as string,
                    services,
                    update: !!argv.update,
                    calm: !!argv.calm,
                    verbose: !!argv.verbose,
                },
                defaultDeps(),
            );
        } catch (err) {
            printError(err as Error);
        }
    },
};
