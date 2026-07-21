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
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverServices, isServiceDir } from '../../lib/services.js';

/**
 * Creates a fake service repository whose src tree contains a class with the
 * given `extends` marker (or none, to simulate a non-service directory).
 */
function makeRepo(
    root: string,
    name: string,
    marker: 'IMQService' | 'IMQClient' | 'none',
    nested = false,
): void {
    const src = nested
        ? join(root, name, 'src', 'deep')
        : join(root, name, 'src');

    mkdirSync(src, { recursive: true });

    const body =
        marker === 'none'
            ? 'export class Plain {}'
            : `export class ${name}Svc extends ${marker} {}`;

    writeFileSync(join(src, 'index.ts'), body);
}

describe('lib/services', () => {
    let root: string;

    before(() => {
        root = mkdtempSync(join(tmpdir(), 'imq-services-'));
        makeRepo(root, 'billing', 'IMQService');
        makeRepo(root, 'auth', 'IMQClient', true);
        makeRepo(root, 'notes', 'none');
        // a plain file, not a directory - must be ignored
        writeFileSync(join(root, 'README.md'), '# not a service');
        // a directory without a src folder - must be ignored
        mkdirSync(join(root, 'docs'), { recursive: true });
    });

    after(() => {
        rmSync(root, { recursive: true, force: true });
    });

    describe('isServiceDir()', () => {
        it('should detect an IMQService in src', () => {
            assert.equal(isServiceDir(join(root, 'billing')), true);
        });

        it('should detect an IMQClient nested deeper in src', () => {
            assert.equal(isServiceDir(join(root, 'auth')), true);
        });

        it('should reject a directory with no service class', () => {
            assert.equal(isServiceDir(join(root, 'notes')), false);
        });

        it('should reject a directory without a src folder', () => {
            assert.equal(isServiceDir(join(root, 'docs')), false);
        });

        it('should reject a non-existent directory', () => {
            assert.equal(isServiceDir(join(root, 'nope')), false);
        });
    });

    describe('discoverServices()', () => {
        it('should find only service directories, sorted', () => {
            assert.deepEqual(discoverServices(root), ['auth', 'billing']);
        });

        it('should return an explicit list verbatim (deduped)', () => {
            assert.deepEqual(discoverServices(root, ['x', 'y', 'x', ' z ']), [
                'x',
                'y',
                'z',
            ]);
        });

        it('should ignore empty explicit entries', () => {
            assert.deepEqual(discoverServices(root, ['', '  ']), []);
        });

        it('should return an empty list for a missing path', () => {
            assert.deepEqual(discoverServices(join(root, 'missing')), []);
        });
    });
});
