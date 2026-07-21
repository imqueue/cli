/*!
 * @imqueue/cli Unit Tests: end-to-end CLI (spawned process, real exit codes)
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
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// the built entry point lives at the repo root; this compiled spec is at
// test/src/, so the root is two levels up
const CLI = resolve(import.meta.dirname, '../../index.js');

describe('cli end-to-end (exit codes & strict mode)', () => {
    let home: string;

    function run(args: string[]) {
        return spawnSync(process.execPath, [CLI, ...args], {
            cwd: resolve(import.meta.dirname, '../..'),
            env: {
                ...process.env,
                IMQ_CLI_HOME: home,
                IMQ_NO_UPDATE_CHECK: '1',
            },
            encoding: 'utf8',
        });
    }

    beforeEach(() => {
        home = mkdtempSync(join(tmpdir(), 'imq-e2e-'));
    });
    afterEach(() => {
        rmSync(home, { recursive: true, force: true });
    });

    it('should exit 0 on --version', () => {
        const r = run(['--version']);

        assert.equal(r.status, 0);
        assert.match(r.stdout, /\d+\.\d+\.\d+/);
    });

    it('should exit non-zero on an unknown command', () => {
        const r = run(['definitely-not-a-command']);

        assert.notEqual(r.status, 0);
    });

    it('should reject an unknown flag under strict mode', () => {
        const r = run([
            'service',
            'create',
            'svc',
            join(home, 'svc'),
            '-a',
            'A',
            '-e',
            'a@b.io',
            '--no-use-git',
            '--bogus-flag',
            '--dry-run',
        ]);

        assert.notEqual(r.status, 0);
        assert.match(r.stderr + r.stdout, /Unknown argument|bogus-flag/);
    });

    it('should accept --no-install under strict mode', () => {
        const r = run([
            'service',
            'create',
            'svc',
            join(home, 'svc'),
            '-a',
            'A',
            '-e',
            'a@b.io',
            '--no-use-git',
            '--no-install',
            '--dry-run',
        ]);

        assert.equal(r.status, 0);
    });

    it('config check should exit 1 empty, 0 after a set', () => {
        assert.equal(run(['config', 'check']).status, 1);

        assert.equal(
            run(['config', 'set', 'vcs.provider', 'github']).status,
            0,
        );
        assert.equal(run(['config', 'check']).status, 0);
    });

    it('config get of an unset key should exit 1', () => {
        const r = run(['config', 'get', 'nope.nope']);

        assert.equal(r.status, 1);
        assert.equal(r.stdout.trim(), '');
    });
});
