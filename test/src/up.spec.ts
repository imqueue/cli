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
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as up from '../../src/up.js';
import type { UpDeps, UpOptions } from '../../src/up.js';

interface Recorder {
    deps: UpDeps;
    calls: string[];
    logs: string[];
    ncuInstalled: boolean;
}

function recorder(over: Partial<UpDeps> = {}): Recorder {
    const rec: Recorder = {
        calls: [],
        logs: [],
        ncuInstalled: false,
        deps: {} as UpDeps,
    };

    rec.deps = {
        ncuAvailable: () => true,
        installNcu() {
            rec.ncuInstalled = true;
            rec.calls.push('installNcu');
        },
        gitPull: (d: string) => rec.calls.push(`gitPull:${base(d)}`),
        ncuUpgrade: (d: string) => rec.calls.push(`ncuUpgrade:${base(d)}`),
        removeArtifacts: (d: string) => rec.calls.push(`rm:${base(d)}`),
        npmInstall: (d: string) => rec.calls.push(`npmInstall:${base(d)}`),
        gitDirty: () => true,
        gitCommit: (d: string) => rec.calls.push(`commit:${base(d)}`),
        npmVersion: (d: string, t: string) =>
            rec.calls.push(`version:${base(d)}:${t}`),
        gitPushTags: (d: string) => rec.calls.push(`push:${base(d)}`),
        log: (m: string) => rec.logs.push(m),
        ...over,
    };

    return rec;
}

function base(dir: string): string {
    return dir.split('/').pop() as string;
}

describe('service up', () => {
    let root: string;

    function makeService(name: string): void {
        const src = join(root, name, 'src');

        mkdirSync(src, { recursive: true });
        writeFileSync(
            join(src, 'index.ts'),
            `export class ${name} extends IMQService {}`,
        );
    }

    function opts(over: Partial<UpOptions> = {}): UpOptions {
        return {
            path: root,
            npmVersion: 'prerelease',
            commit: false,
            skipUpdate: false,
            ...over,
        };
    }

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'imq-up-'));
    });
    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it('should be a valid command definition', () => {
        assert.equal(typeof up.command, 'string');
        assert.ok(up.command.includes('up'));
        assert.equal(typeof up.handler, 'function');
    });

    describe('normalizeVersionType()', () => {
        it('should pass through valid keywords', () => {
            for (const t of ['major', 'minor', 'patch', 'prerelease']) {
                assert.equal(up.normalizeVersionType(t), t);
            }
        });

        it('should default unknown keywords to prerelease', () => {
            assert.equal(up.normalizeVersionType('bananas'), 'prerelease');
            assert.equal(up.normalizeVersionType(''), 'prerelease');
        });
    });

    describe('runUp()', () => {
        it('should throw when neither update nor commit is requested', () => {
            const rec = recorder();

            assert.throws(
                () => up.runUp(opts({ skipUpdate: true }), rec.deps),
                /Nothing to perform/,
            );
        });

        it('should report when no services are found', () => {
            const rec = recorder();

            up.runUp(opts(), rec.deps);

            assert.ok(rec.logs.some(l => l.includes('No IMQ services')));
            assert.equal(rec.calls.length, 0);
        });

        it('should run the full update flow per service', () => {
            makeService('billing');

            const rec = recorder();

            up.runUp(opts(), rec.deps);

            assert.deepEqual(rec.calls, [
                'gitPull:billing',
                'ncuUpgrade:billing',
                'rm:billing',
                'npmInstall:billing',
            ]);
        });

        it('should bootstrap ncu when unavailable', () => {
            makeService('billing');

            const rec = recorder({ ncuAvailable: () => false });

            up.runUp(opts(), rec.deps);

            assert.ok(rec.ncuInstalled);
        });

        it('should not install ncu when it is available', () => {
            makeService('billing');

            const rec = recorder({ ncuAvailable: () => true });

            up.runUp(opts(), rec.deps);

            assert.ok(!rec.ncuInstalled);
        });

        it('should commit, version-bump and push when dirty', () => {
            makeService('billing');

            const rec = recorder();

            up.runUp(opts({ commit: true, npmVersion: 'minor' }), rec.deps);

            assert.ok(rec.calls.includes('commit:billing'));
            assert.ok(rec.calls.includes('version:billing:minor'));
            assert.ok(rec.calls.includes('push:billing'));
        });

        it('should skip commit when the tree is clean', () => {
            makeService('billing');

            const rec = recorder({ gitDirty: () => false });

            up.runUp(opts({ commit: true }), rec.deps);

            assert.ok(!rec.calls.some(c => c.startsWith('commit')));
            assert.ok(rec.logs.some(l => l.includes('Nothing to commit')));
        });

        it('should skip the update but still commit with --skip-update', () => {
            makeService('billing');

            const rec = recorder();

            up.runUp(opts({ skipUpdate: true, commit: true }), rec.deps);

            assert.ok(!rec.calls.some(c => c.startsWith('gitPull')));
            assert.ok(!rec.calls.some(c => c.startsWith('ncuUpgrade')));
            assert.ok(rec.calls.includes('commit:billing'));
        });

        it('should default an unknown version keyword to prerelease', () => {
            makeService('billing');

            const rec = recorder();

            up.runUp(opts({ commit: true, npmVersion: 'weird' }), rec.deps);

            assert.ok(rec.calls.includes('version:billing:prerelease'));
        });

        it('should throw a summary when a service step fails', () => {
            makeService('billing');

            const rec = recorder({
                gitPull: () => {
                    throw new Error('merge conflict');
                },
            });

            assert.throws(
                () => up.runUp(opts(), rec.deps),
                /Updated 0\/1 services; failed: billing/,
            );
        });

        it('should abort before destructive steps on failure', () => {
            makeService('billing');

            const rec = recorder({
                gitPull: () => {
                    throw new Error('offline');
                },
            });

            try {
                up.runUp(opts(), rec.deps);
            } catch {
                /* expected */
            }

            // a failed git pull must stop before ncu/rm/install run
            assert.ok(!rec.calls.some(c => c.startsWith('ncuUpgrade')));
            assert.ok(!rec.calls.some(c => c.startsWith('rm:')));
            assert.ok(!rec.calls.some(c => c.startsWith('npmInstall')));
        });
    });
});
