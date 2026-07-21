/*!
 * @imqueue/cli Unit Tests: scm/git initAndPush (against a local bare remote)
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
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git } from '../../../src/providers/scm/git.js';

const hasGit = (() => {
    try {
        execFileSync('git', ['--version'], { stdio: 'ignore' });

        return true;
    } catch {
        return false;
    }
})();

describe('scm/git initAndPush()', { skip: !hasGit }, () => {
    const roots: string[] = [];

    after(() => {
        for (const r of roots) {
            rmSync(r, { recursive: true, force: true });
        }
    });

    it('should commit, push and tag against a bare remote', async () => {
        const work = mkdtempSync(join(tmpdir(), 'imq-scm-work-'));
        const bare = mkdtempSync(join(tmpdir(), 'imq-scm-bare-'));

        roots.push(work, bare);

        writeFileSync(join(work, 'index.ts'), 'export const x = 1;\n');
        execFileSync('git', ['init', '--bare', bare], { stdio: 'ignore' });

        const ctx = {
            path: work,
            version: '1.0.0',
            author: 'Test',
            email: 't@e.io',
        } as any;

        await git.initAndPush(ctx, bare);

        // the bare remote now has our initial commit and the version tag
        const tags = execFileSync('git', [`--git-dir=${bare}`, 'tag'], {
            encoding: 'utf8',
        });

        assert.match(tags, /v1\.0\.0/);

        const log = execFileSync(
            'git',
            [`--git-dir=${bare}`, 'log', '--oneline'],
            { encoding: 'utf8' },
        );

        assert.match(log, /Initial commit/);
    });
});
