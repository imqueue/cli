/*!
 * @imqueue/cli Unit Tests: ssh key detection / git protocol default
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
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import '../../mocks/index.js';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hasSshKeys, detectGitProtocol } from '../../../lib/ssh.js';

const roots: string[] = [];

function ssh(files: string[]): string {
    const dir = mkdtempSync(join(tmpdir(), 'imq-ssh-'));

    roots.push(dir);

    for (const f of files) {
        writeFileSync(join(dir, f), 'x');
    }

    return dir;
}

describe('ssh key detection', () => {
    after(() => {
        for (const r of roots) {
            rmSync(r, { recursive: true, force: true });
        }
    });

    it('should detect a conventional private key', () => {
        const dir = ssh(['id_ed25519', 'id_ed25519.pub', 'known_hosts']);

        assert.equal(hasSshKeys(dir), true);
        assert.equal(detectGitProtocol(dir), 'ssh');
    });

    it('should detect an rsa key pair', () => {
        assert.equal(hasSshKeys(ssh(['id_rsa', 'id_rsa.pub'])), true);
    });

    it('should treat any *.pub as evidence of keys', () => {
        assert.equal(hasSshKeys(ssh(['work_key.pub'])), true);
    });

    it('should report no keys for a dir with only config/known_hosts', () => {
        const dir = ssh(['config', 'known_hosts']);

        assert.equal(hasSshKeys(dir), false);
        assert.equal(detectGitProtocol(dir), 'https');
    });

    it('should default to https when the ssh dir is absent', () => {
        const dir = mkdtempSync(join(tmpdir(), 'imq-nossh-'));

        roots.push(dir);
        // point at a non-existent subdir
        const missing = join(dir, 'no-such-ssh');

        assert.equal(hasSshKeys(missing), false);
        assert.equal(detectGitProtocol(missing), 'https');
    });

    it('should honor the IMQ_SSH_DIR override for the default dir', () => {
        const dir = ssh(['id_ecdsa']);
        const prev = process.env.IMQ_SSH_DIR;

        process.env.IMQ_SSH_DIR = dir;

        try {
            assert.equal(detectGitProtocol(), 'ssh');
        } finally {
            if (prev === undefined) {
                delete process.env.IMQ_SSH_DIR;
            } else {
                process.env.IMQ_SSH_DIR = prev;
            }
        }
    });
});
