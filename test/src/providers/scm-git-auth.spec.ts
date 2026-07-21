/*!
 * @imqueue/cli Unit Tests: scm/git initAndPush() HTTPS token authentication
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
import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import '../../mocks/index.js';

// record every git invocation so we can assert on argv without a network or a
// real remote. node:test runs each spec file in its own process, so mocking
// the child_process builtin here does not leak into other specs.
interface Call {
    cmd: string;
    args: string[];
}
const calls: Call[] = [];

const execFileSync = (cmd: string, args: string[] = []) => {
    calls.push({ cmd, args });

    // the provider reads the current branch from `git rev-parse`
    return args[0] === 'rev-parse' ? Buffer.from('main\n') : Buffer.from('');
};
// commandExists() probes with spawnSync; report git as present
const spawnSync = () => ({ status: 0 });

// `child_process` and `node:child_process` resolve to the same builtin, so a
// single mock covers both import specifiers. The wider module graph (lib) also
// imports execSync/spawn from child_process, so they must be present (as inert
// stubs) or linking the graph fails.
mock.module('child_process', {
    cache: false,
    namedExports: {
        execFileSync,
        spawnSync,
        execSync: () => Buffer.from(''),
        spawn: () => ({}),
    },
});

const { git } = await import('../../../src/providers/scm/git.js');

const ctx = {
    path: '/tmp/does-not-matter',
    version: '1.0.0',
    author: 'Test',
    email: 't@e.io',
} as any;

const pushCalls = () =>
    calls.filter(c => c.cmd === 'git' && c.args.includes('push'));

describe('scm/git initAndPush() https token auth', () => {
    beforeEach(() => {
        calls.length = 0;
    });

    it('should authenticate https pushes with an ephemeral extraHeader', async () => {
        await git.initAndPush(ctx, 'https://github.com/acme/my-svc.git', {
            user: 'x-access-token',
            token: 's3cr3t',
        });

        // every push carries the auth header as a per-invocation -c option
        const pushes = pushCalls();

        assert.ok(pushes.length >= 2, 'branch and tag pushes happened');

        for (const p of pushes) {
            assert.equal(
                p.args[0],
                '-c',
                'auth is passed before the subcommand',
            );
            assert.match(p.args[1], /^http\.extraHeader=Authorization: Basic /);

            const b64 = p.args[1].replace(
                /^http\.extraHeader=Authorization: Basic /,
                '',
            );

            assert.equal(
                Buffer.from(b64, 'base64').toString(),
                'x-access-token:s3cr3t',
                'the token is sent as basic-auth password',
            );
        }
    });

    it('should keep the token out of the persisted remote url', async () => {
        await git.initAndPush(ctx, 'https://github.com/acme/my-svc.git', {
            user: 'x-access-token',
            token: 's3cr3t',
        });

        const remoteAdd = calls.find(
            c => c.args[0] === 'remote' && c.args[1] === 'add',
        );

        assert.ok(remoteAdd, 'a remote was added');
        // the url written into .git/config must be clean (no embedded token)
        assert.equal(remoteAdd.args[3], 'https://github.com/acme/my-svc.git');
        assert.doesNotMatch(remoteAdd.args[3], /s3cr3t/);
    });

    it('should not inject a header without auth or for a non-https remote', async () => {
        await git.initAndPush(ctx, 'git@github.com:acme/my-svc.git');

        for (const p of pushCalls()) {
            assert.notEqual(p.args[0], '-c');
        }

        calls.length = 0;

        // even when auth is supplied, an ssh remote must not carry the header
        await git.initAndPush(ctx, 'git@github.com:acme/my-svc.git', {
            user: 'x-access-token',
            token: 's3cr3t',
        });

        for (const p of pushCalls()) {
            assert.notEqual(p.args[0], '-c');
        }
    });
});
