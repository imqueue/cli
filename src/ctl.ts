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
    closeSync,
    existsSync,
    mkdirSync,
    openSync,
    readFileSync,
    writeFileSync,
} from 'fs';
import { join, resolve } from 'path';
import { styleText } from 'node:util';
import { type Argv, type Arguments } from 'yargs';
import {
    VAR_HOME,
    discoverServices,
    parseServices,
    printError,
} from '../lib/index.js';

/** Log line emitted by a healthy service once its IMQ reader channel is up. */
const READY_MARKER = 'reader channel connected';
/**
 * Log fragments that indicate a service errored during startup. Covers both the
 * legacy Node warning text and the modern `ERR_UNHANDLED_REJECTION` code, so a
 * crash is recognised across Node versions rather than only via the dead-pid
 * fallback.
 */
const ERROR_MARKERS = [
    'UnhandledPromiseRejection',
    'ERR_UNHANDLED_REJECTION',
] as const;
/** How many one-second polls to wait for readiness in calm mode. */
const MAX_READY_ATTEMPTS = 60;
/** Interval between liveness polls while stopping a service (ms). */
const STOP_POLL_MS = 250;
/** Polls to await graceful SIGTERM shutdown before escalating (~5s). */
const STOP_TERM_ATTEMPTS = 20;
/** Polls to await death after SIGKILL before giving up (~2s). */
const STOP_KILL_ATTEMPTS = 8;

/**
 * Side-effectful primitives used by the ctl orchestration. Extracted behind an
 * interface so the control flow can be unit-tested with fakes while the real
 * command wires in process spawning, git and the filesystem.
 */
export interface CtlDeps {
    /**
     * Starts `npm run dev` for a service, truncating logFile and piping output
     * to it. Returns the master pid, or 0 if the process failed to start.
     */
    startService(dir: string, logFile: string): number;
    /** Runs `git pull` in the service directory; throws on failure. */
    gitPull(dir: string): void;
    /** Runs `npm run stop` in the service directory (best-effort). */
    stopService(dir: string): void;
    /** Signals a started process (and its group) by pid; defaults to SIGTERM. */
    killGroup(pid: number, signal?: NodeJS.Signals): void;
    /** True if a process with the given pid is currently running. */
    isAlive(pid: number): boolean;
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

/**
 * Outcome of waiting for a service to become ready in calm mode.
 * - `ready`   - the readiness marker appeared;
 * - `crashed` - the process exited during startup (dead pid);
 * - `errored` - an error was logged but the process is still alive;
 * - `timeout` - neither readiness nor an error within the attempt budget.
 */
export type ReadyState = 'ready' | 'crashed' | 'errored' | 'timeout';

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
 * Polls a service log file until it reports readiness, the process exits
 * (crashed during startup), or the attempt budget is exhausted. Used by calm
 * mode so services start one-at-a-time rather than all at once. Because the
 * log is truncated on start, the readiness scan only ever sees the current
 * run - it cannot be fooled by a marker left over from a previous run.
 *
 * @param {string} logFile - path to the service log
 * @param {number} pid - master pid of the started service
 * @param {CtlDeps} deps - injected primitives
 * @param {number} [maxAttempts] - number of one-second polls before timing out
 * @return {Promise<ReadyState>}
 */
export async function waitForReady(
    logFile: string,
    pid: number,
    deps: CtlDeps,
    maxAttempts: number = MAX_READY_ATTEMPTS,
): Promise<ReadyState> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const log = deps.readLog(logFile);

        if (log.includes(READY_MARKER)) {
            return 'ready';
        }

        // a dead process is a definite startup crash - report it at once
        // instead of waiting out the budget
        if (!deps.isAlive(pid)) {
            return 'crashed';
        }

        // an error was logged but the process is still alive: surface it as a
        // distinct (softer) signal - it may still recover or keep running
        if (ERROR_MARKERS.some(marker => log.includes(marker))) {
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
        // a start that finds nothing is a failure, not a silent success: CI
        // must be able to detect a wrong --path
        throw new Error(
            `No IMQ services found under ${resolve(opts.path)}. A service is ` +
                'a directory whose src/ tree contains a class extending ' +
                'IMQService or IMQClient (or pass -s <name> explicitly).',
        );
    }

    const varHome = ensureVarHome(opts);
    // keep pids of services we are not (re)starting; index by name so a
    // restarted service replaces its stale pid rather than duplicating it
    const pids = new Map<string, number>();

    for (const { svc, pid } of readPids(varHome)) {
        pids.set(svc, pid);
    }

    // persist the pid file after every change so an interrupt mid-loop (e.g.
    // Ctrl+C during a calm start) still leaves a record of what was started
    const persist = () =>
        writePids(
            varHome,
            [...pids].map(([svc, pid]) => ({ svc, pid })),
        );

    let startedAny = false;
    const failed: string[] = [];

    for (const svc of services) {
        const dir = join(opts.path, svc);

        if (!existsSync(dir)) {
            deps.log(styleText('red', `No such service directory: ${dir}`));
            failed.push(svc);

            continue;
        }

        // don't orphan an already-running instance: skip it and tell the user
        // to restart if that is what they meant
        const running = pids.get(svc);

        if (running !== undefined && deps.isAlive(running)) {
            deps.log(
                styleText(
                    'yellow',
                    `warn: ${svc} is already running (pid ${running}); ` +
                        "use 'imq ctl restart' to restart it.",
                ),
            );

            continue;
        }

        if (opts.update) {
            deps.log(`Updating ${svc}...`);

            try {
                deps.gitPull(dir);
            } catch (err) {
                deps.log(
                    styleText(
                        'yellow',
                        `warn: skipping ${svc} - git pull failed: ` +
                            `${(err as Error).message}`,
                    ),
                );
                failed.push(svc);

                continue;
            }
        }

        const logFile = join(varHome, `${svc}.log`);
        const pid = deps.startService(dir, logFile);

        if (!pid) {
            deps.log(styleText('red', `Failed to start ${svc}.`));
            failed.push(svc);

            continue;
        }

        pids.set(svc, pid);
        persist();
        startedAny = true;
        deps.log(`Starting ${svc}, master pid is ${pid}...`);

        if (opts.calm) {
            const state = await waitForReady(logFile, pid, deps);

            if (state === 'crashed') {
                deps.log(
                    styleText(
                        'red',
                        `warn: ${svc} exited during startup, please check ` +
                            `its logs ('imq log ${svc}').`,
                    ),
                );
                failed.push(svc);
            } else if (state === 'errored') {
                deps.log(
                    styleText(
                        'yellow',
                        `warn: ${svc} logged an error during startup and may ` +
                            `not be healthy, please check its logs ` +
                            `('imq log ${svc}').`,
                    ),
                );
                failed.push(svc);
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

    persist();

    if (startedAny && !opts.calm) {
        deps.log('Bulk service start initiated, please be patient...');
    }

    // surface partial failures with a non-zero exit (handler -> printError),
    // matching `imq up`; a pure timeout is a warning, not a failure
    if (failed.length) {
        throw new Error(
            `Started ${services.length - failed.length}/${services.length} ` +
                `service(s); failed: ${failed.join(', ')}.`,
        );
    }
}

/**
 * Polls the given pid entries until they all die or the attempt budget is
 * exhausted, returning those still alive.
 *
 * @param {PidEntry[]} entries - processes to await
 * @param {CtlDeps} deps
 * @param {number} attempts - number of {@link STOP_POLL_MS} polls
 * @return {Promise<PidEntry[]>} - entries still alive after waiting
 */
async function waitForDeath(
    entries: PidEntry[],
    deps: CtlDeps,
    attempts: number,
): Promise<PidEntry[]> {
    let alive = entries.filter(e => deps.isAlive(e.pid));

    for (let i = 0; alive.length && i < attempts; i++) {
        await deps.sleep(STOP_POLL_MS);
        alive = alive.filter(e => deps.isAlive(e.pid));
    }

    return alive;
}

/**
 * Stops the selected services: signals their recorded master processes, waits
 * for them to actually terminate (escalating SIGTERM -> SIGKILL), runs each
 * service's `stop` script, and prints a summary. Pids of services we could not
 * kill are kept in the pid file (with a warning) so `status` still reflects
 * reality and a later `start` won't spawn a duplicate.
 *
 * When run from a directory where no services can be discovered and no explicit
 * `-s` was given, it falls back to stopping every tracked pid, so `imq ctl stop`
 * works from anywhere rather than silently doing nothing.
 *
 * @param {CtlOptions} opts
 * @param {CtlDeps} deps
 * @return {Promise<void>}
 */
export async function stopServices(
    opts: CtlOptions,
    deps: CtlDeps,
): Promise<void> {
    const varHome = ensureVarHome(opts);
    const discovered = discoverServices(opts.path, opts.services);
    const allPids = readPids(varHome);
    // scope to the discovered/explicit set; if nothing is discoverable here and
    // no -s was given, fall back to every tracked pid (works from any cwd)
    const scoped = !!opts.services?.length || discovered.length > 0;
    const target = scoped
        ? new Set(discovered)
        : new Set(allPids.map(e => e.svc));

    const toStop = allPids.filter(e => target.has(e.svc));
    const untouched = allPids.filter(e => !target.has(e.svc));

    if (!toStop.length) {
        deps.log(
            'Nothing to stop - no matching services are tracked as running.',
        );

        return;
    }

    for (const entry of toStop) {
        deps.log(`Stopping ${entry.svc} (pid ${entry.pid})...`);
        deps.killGroup(entry.pid);
    }

    // wait for graceful shutdown, then escalate to SIGKILL for any stragglers
    let alive = await waitForDeath(toStop, deps, STOP_TERM_ATTEMPTS);

    if (alive.length) {
        for (const entry of alive) {
            deps.log(
                styleText(
                    'yellow',
                    `warn: ${entry.svc} (pid ${entry.pid}) did not stop on ` +
                        'SIGTERM; sending SIGKILL...',
                ),
            );
            deps.killGroup(entry.pid, 'SIGKILL');
        }

        alive = await waitForDeath(alive, deps, STOP_KILL_ATTEMPTS);
    }

    // keep entries we could not kill (plus unrelated ones); drop the stopped
    const survivors = new Set(alive.map(e => e.pid));

    writePids(varHome, [
        ...untouched,
        ...toStop.filter(e => survivors.has(e.pid)),
    ]);

    for (const svc of discovered) {
        const dir = join(opts.path, svc);

        if (target.has(svc) && existsSync(dir)) {
            deps.stopService(dir);
        }
    }

    const stopped = toStop.length - alive.length;

    deps.log(
        alive.length
            ? styleText(
                  'yellow',
                  `Stopped ${stopped} service(s); ${alive.length} refused to ` +
                      `terminate: ${alive.map(e => e.svc).join(', ')}.`,
              )
            : `Stopped ${stopped} service(s).`,
    );
}

/**
 * Reports the recorded services and whether each is currently running,
 * distinguishing live pids from stale ones left by a crash or reboot.
 *
 * @param {CtlOptions} opts
 * @param {CtlDeps} deps
 * @return {void}
 */
export function statusServices(opts: CtlOptions, deps: CtlDeps): void {
    const varHome = opts.varHome || VAR_HOME;
    const all = readPids(varHome);
    const scope = opts.services?.length ? new Set(opts.services) : undefined;
    const shown = scope ? all.filter(e => scope.has(e.svc)) : all;

    if (!shown.length) {
        deps.log('No services are currently tracked as running.');

        return;
    }

    const stale: string[] = [];

    for (const { svc, pid } of shown) {
        if (deps.isAlive(pid)) {
            deps.log(`${svc}: ${styleText('green', `running (pid ${pid})`)}`);
        } else {
            deps.log(
                `${svc}: ${styleText('red', `not running (stale pid ${pid})`)}`,
            );
            stale.push(`${svc}:${pid}`);
        }
    }

    // prune the stale entries we examined, preserving every other record
    // (including entries outside a -s filter we never looked at)
    if (stale.length) {
        const staleKeys = new Set(stale);

        writePids(
            varHome,
            all.filter(e => !staleKeys.has(`${e.svc}:${e.pid}`)),
        );
    }
}

/**
 * Runs a ctl action (start | stop | restart | status) end-to-end, honoring
 * verbose timing.
 *
 * @param {'start'|'stop'|'restart'|'status'} action
 * @param {CtlOptions} opts
 * @param {CtlDeps} deps
 * @return {Promise<void>}
 */
export async function runCtl(
    action: 'start' | 'stop' | 'restart' | 'status',
    opts: CtlOptions,
    deps: CtlDeps,
): Promise<void> {
    if (action === 'status') {
        statusServices(opts, deps);

        return;
    }

    const started = deps.now();

    if (action === 'stop' || action === 'restart') {
        // awaited: on restart this guarantees the old processes are dead (and
        // their logs settled) before startServices truncates and respawns
        await stopServices(opts, deps);
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
            // truncate ('w'): the log and the calm-mode readiness scan must
            // reflect only this run, never a stale marker from a previous one
            const out = openSync(logFile, 'w');

            try {
                const child = spawn('npm', ['run', '--silent', 'dev'], {
                    cwd: dir,
                    detached: true,
                    stdio: ['ignore', out, out],
                });

                // swallow async spawn errors (e.g. npm not on PATH) so they
                // don't crash the CLI with an unhandled 'error' event; a failed
                // spawn leaves child.pid undefined -> reported as a start error
                child.on('error', () => undefined);
                child.unref();

                return child.pid ?? 0;
            } finally {
                // the child dup'd the fd; close the parent's copy to avoid a leak
                closeSync(out);
            }
        },
        gitPull(dir: string): void {
            const res = spawnSync('git', ['pull'], {
                cwd: dir,
                stdio: 'inherit',
            });

            if (res.error) {
                throw new Error(res.error.message);
            }

            if (res.status !== 0) {
                throw new Error(`git pull exited with code ${res.status}`);
            }
        },
        stopService(dir: string): void {
            // best-effort: services without a `stop` script simply no-op
            spawnSync('npm', ['run', '--silent', 'stop'], {
                cwd: dir,
                stdio: 'ignore',
            });
        },
        killGroup(pid: number, signal: NodeJS.Signals = 'SIGTERM'): void {
            try {
                // detached children lead their own process group (pgid = pid),
                // so a negative pid signals the whole tree
                process.kill(-pid, signal);
            } catch {
                try {
                    process.kill(pid, signal);
                } catch {
                    /* already gone */
                }
            }
        },
        isAlive(pid: number): boolean {
            try {
                // signal 0 performs existence/permission checks without
                // actually sending a signal
                process.kill(pid, 0);

                return true;
            } catch (err) {
                // ESRCH -> no such process; EPERM -> alive but not ours
                return (err as NodeJS.ErrnoException).code === 'EPERM';
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
        'Controls a set of IMQ services (start, stop, restart or status) ' +
        'located under a given path.',

    builder(yargs: Argv) {
        return yargs
            .positional('action', {
                describe: 'Action to perform on the services.',
                choices: ['start', 'stop', 'restart', 'status'] as const,
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
            const services = parseServices(argv.services);

            await runCtl(
                argv.action as 'start' | 'stop' | 'restart' | 'status',
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
