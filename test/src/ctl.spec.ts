/*!
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
import '../mocks/index.js';
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as ctl from '../../src/ctl.js';
import type { CtlDeps, CtlOptions } from '../../src/ctl.js';

/** Records every dep call so tests can assert the orchestration. */
interface Recorder {
    deps: CtlDeps;
    started: string[];
    pulled: string[];
    stopped: string[];
    killed: number[];
    logs: string[];
    logContent: Map<string, string>;
    alive: Map<number, boolean>;
    pidSeq: number;
}

function recorder(logContent: Record<string, string> = {}): Recorder {
    const rec: Recorder = {
        started: [],
        pulled: [],
        stopped: [],
        killed: [],
        logs: [],
        logContent: new Map(Object.entries(logContent)),
        alive: new Map(),
        pidSeq: 1000,
        deps: {} as CtlDeps,
    };

    rec.deps = {
        startService(dir: string): number {
            rec.started.push(dir);

            return ++rec.pidSeq;
        },
        gitPull(dir: string): void {
            rec.pulled.push(dir);
        },
        stopService(dir: string): void {
            rec.stopped.push(dir);
        },
        killGroup(pid: number): void {
            rec.killed.push(pid);
            // model a successful kill so waitForDeath sees the process exit;
            // tests simulating a stubborn process override killGroup/isAlive
            rec.alive.set(pid, false);
        },
        isAlive(pid: number): boolean {
            // by default every recorded pid is considered alive; individual
            // tests override rec.deps.isAlive to simulate dead/crashed procs
            return rec.alive.has(pid) ? rec.alive.get(pid)! : true;
        },
        readLog(logFile: string): string {
            return rec.logContent.get(logFile) ?? '';
        },
        sleep(): Promise<void> {
            return Promise.resolve();
        },
        now(): number {
            // two distinct values so verbose timing has something to print
            return rec.logs.length ? 5000 : 0;
        },
        log(msg: string): void {
            rec.logs.push(msg);
        },
    };

    return rec;
}

describe('service ctl', () => {
    let root: string;

    function makeService(name: string): string {
        const src = join(root, name, 'src');

        mkdirSync(src, { recursive: true });
        writeFileSync(
            join(src, 'index.ts'),
            `export class ${name} extends IMQService {}`,
        );

        return join(root, name);
    }

    function opts(over: Partial<CtlOptions> = {}): CtlOptions {
        return {
            path: root,
            update: false,
            calm: false,
            verbose: false,
            varHome: join(root, '.var'),
            ...over,
        };
    }

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'imq-ctl-'));
    });
    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it('should be a valid command definition', () => {
        assert.equal(typeof ctl.command, 'string');
        assert.ok(ctl.command.includes('ctl'));
        assert.equal(typeof ctl.handler, 'function');
    });

    describe('readPids()/writePids()', () => {
        it('should round-trip entries and ignore malformed lines', () => {
            const varHome = join(root, '.var');

            mkdirSync(varHome, { recursive: true });
            writeFileSync(
                join(varHome, '.pids'),
                'billing:111\n\ngarbage\nauth:222\nbad:abc\n',
            );

            assert.deepEqual(ctl.readPids(varHome), [
                { svc: 'billing', pid: 111 },
                { svc: 'auth', pid: 222 },
            ]);

            ctl.writePids(varHome, [{ svc: 'x', pid: 9 }]);
            assert.equal(readFileSync(join(varHome, '.pids'), 'utf8'), 'x:9\n');
        });

        it('should return an empty list when the pid file is missing', () => {
            assert.deepEqual(ctl.readPids(join(root, 'nowhere')), []);
        });
    });

    describe('waitForReady()', () => {
        it('should return ready when the marker appears', async () => {
            const rec = recorder({ '/l': 'reader channel connected' });

            assert.equal(await ctl.waitForReady('/l', 1, rec.deps, 3), 'ready');
        });

        it('should return errored on an unhandled rejection', async () => {
            const rec = recorder({ '/l': 'UnhandledPromiseRejectionWarning:' });

            assert.equal(
                await ctl.waitForReady('/l', 1, rec.deps, 3),
                'errored',
            );
        });

        it('should return crashed when the process is dead', async () => {
            const rec = recorder();

            rec.alive.set(7, false);

            assert.equal(
                await ctl.waitForReady('/l', 7, rec.deps, 3),
                'crashed',
            );
        });

        it('should time out when nothing is logged and the process lives', async () => {
            const rec = recorder();

            assert.equal(
                await ctl.waitForReady('/l', 1, rec.deps, 3),
                'timeout',
            );
        });
    });

    describe('startServices()', () => {
        it('should start discovered services and record pids', async () => {
            makeService('billing');
            makeService('auth');

            const rec = recorder();

            await ctl.startServices(opts(), rec.deps);

            assert.deepEqual(rec.started.sort(), [
                join(root, 'auth'),
                join(root, 'billing'),
            ]);

            const pids = ctl.readPids(join(root, '.var'));

            assert.deepEqual(pids.map(p => p.svc).sort(), ['auth', 'billing']);
            assert.ok(rec.logs.some(l => l.includes('Bulk service start')));
        });

        it('should git pull before start with update flag', async () => {
            makeService('billing');

            const rec = recorder();

            await ctl.startServices(opts({ update: true }), rec.deps);

            assert.deepEqual(rec.pulled, [join(root, 'billing')]);
        });

        it('should honor an explicit service list', async () => {
            makeService('billing');
            makeService('auth');

            const rec = recorder();

            await ctl.startServices(opts({ services: ['auth'] }), rec.deps);

            assert.deepEqual(rec.started, [join(root, 'auth')]);
        });

        it('should preserve pids of services it does not restart', async () => {
            makeService('billing');

            const varHome = join(root, '.var');

            mkdirSync(varHome, { recursive: true });
            writeFileSync(join(varHome, '.pids'), 'other:777\n');

            const rec = recorder();

            await ctl.startServices(opts(), rec.deps);

            const pids = ctl.readPids(varHome);

            assert.ok(pids.find(p => p.svc === 'other' && p.pid === 777));
            assert.ok(pids.find(p => p.svc === 'billing'));
        });

        it('should report when no services are found', async () => {
            const rec = recorder();

            await ctl.startServices(opts(), rec.deps);

            assert.equal(rec.started.length, 0);
            assert.ok(rec.logs.some(l => l.includes('No IMQ services')));
        });

        it('should wait for readiness in calm mode', async () => {
            makeService('billing');

            const rec = recorder();
            const logFile = join(root, '.var', 'billing.log');

            rec.logContent.set(logFile, 'reader channel connected');

            await ctl.startServices(opts({ calm: true }), rec.deps);

            // calm mode does not print the bulk-start banner
            assert.ok(!rec.logs.some(l => l.includes('Bulk service start')));
        });

        it('should skip an already-running service instead of orphaning it', async () => {
            makeService('billing');

            const varHome = join(root, '.var');

            mkdirSync(varHome, { recursive: true });
            writeFileSync(join(varHome, '.pids'), 'billing:4242\n');

            const rec = recorder();

            rec.alive.set(4242, true); // pretend billing is still running

            await ctl.startServices(opts(), rec.deps);

            assert.equal(rec.started.length, 0);
            assert.ok(rec.logs.some(l => l.includes('already running')));
            // the live pid is preserved untouched
            assert.deepEqual(ctl.readPids(varHome), [
                { svc: 'billing', pid: 4242 },
            ]);
        });

        it('should (re)start a service whose recorded pid is dead', async () => {
            makeService('billing');

            const varHome = join(root, '.var');

            mkdirSync(varHome, { recursive: true });
            writeFileSync(join(varHome, '.pids'), 'billing:4242\n');

            const rec = recorder();

            rec.alive.set(4242, false); // stale pid

            await ctl.startServices(opts(), rec.deps);

            assert.deepEqual(rec.started, [join(root, 'billing')]);
        });
    });

    describe('statusServices()', () => {
        it('should report live and stale pids', () => {
            const varHome = join(root, '.var');

            mkdirSync(varHome, { recursive: true });
            writeFileSync(join(varHome, '.pids'), 'alive:11\ndead:22\n');

            const rec = recorder();

            rec.alive.set(11, true);
            rec.alive.set(22, false);

            ctl.statusServices({ ...opts(), varHome }, rec.deps);

            assert.ok(
                rec.logs.some(
                    l => l.includes('alive') && l.includes('running'),
                ),
            );
            assert.ok(
                rec.logs.some(l => l.includes('dead') && l.includes('stale')),
            );
        });

        it('should report when nothing is tracked', () => {
            const rec = recorder();

            ctl.statusServices(opts(), rec.deps);

            assert.ok(rec.logs.some(l => l.includes('No services')));
        });
    });

    describe('stopServices()', () => {
        it('should kill targeted pids and keep the rest', async () => {
            makeService('billing');

            const varHome = join(root, '.var');

            mkdirSync(varHome, { recursive: true });
            writeFileSync(join(varHome, '.pids'), 'billing:111\nother:222\n');

            const rec = recorder();

            await ctl.stopServices(opts(), rec.deps);

            assert.deepEqual(rec.killed, [111]);
            assert.deepEqual(rec.stopped, [join(root, 'billing')]);
            assert.deepEqual(ctl.readPids(varHome), [
                { svc: 'other', pid: 222 },
            ]);
        });
    });

    describe('runCtl()', () => {
        it('should stop then start on restart', async () => {
            makeService('billing');

            const varHome = join(root, '.var');

            mkdirSync(varHome, { recursive: true });
            writeFileSync(join(varHome, '.pids'), 'billing:111\n');

            const rec = recorder();

            await ctl.runCtl('restart', opts(), rec.deps);

            assert.deepEqual(rec.killed, [111]);
            assert.deepEqual(rec.started, [join(root, 'billing')]);
        });

        it('should print timing in verbose mode', async () => {
            makeService('billing');

            const rec = recorder();

            await ctl.runCtl('start', opts({ verbose: true }), rec.deps);

            assert.ok(rec.logs.some(l => /executed in \d+ sec/.test(l)));
        });
    });
});
