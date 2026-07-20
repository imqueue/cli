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
import '../../mocks/index.js';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as updateVersion from '../../../src/service/update-version.js';

const { containsServiceClass, resolveServiceEntry } = updateVersion;

describe('service update-version', () => {
    it('should be a valid command definition', () => {
        assert.equal(typeof updateVersion.command, 'string');
        assert.ok(updateVersion.command.includes('update-version'));
        assert.equal(typeof updateVersion.describe, 'string');
        assert.equal(typeof updateVersion.handler, 'function');
    });

    describe('containsServiceClass()', () => {
        class IMQService {}
        class DirectService extends IMQService {}
        class Intermediate extends IMQService {}
        class DeepService extends Intermediate {}
        class UnrelatedService {}

        it('should detect a direct IMQService subclass', () => {
            assert.equal(containsServiceClass({ DirectService }), true);
        });

        it('should detect a transitive IMQService subclass', () => {
            assert.equal(containsServiceClass({ DeepService }), true);
        });

        it('should keep scanning past non-service *Service exports', () => {
            assert.equal(
                containsServiceClass({
                    ServiceOptions: { some: 'object' },
                    UnrelatedService,
                    DirectService,
                }),
                true,
            );
        });

        it('should return false when nothing derives IMQService', () => {
            assert.equal(
                containsServiceClass({
                    UnrelatedService,
                    helper: () => undefined,
                    CONSTANT: 42,
                }),
                false,
            );
        });

        it('should detect a service exported under any name', () => {
            // services are named after the service (e.g. Billing), not always
            // *Service, so detection must not depend on the export name
            assert.equal(
                containsServiceClass({ Billing: DirectService }),
                true,
            );
        });
    });

    describe('resolveServiceEntry()', () => {
        let dir: string;

        before(() => {
            dir = mkdtempSync(join(tmpdir(), 'imq-cli-test-'));
        });
        after(() => {
            rmSync(dir, { recursive: true, force: true });
        });

        function pkgDir(name: string, pkg: object): string {
            const path = join(dir, name);

            mkdirSync(path, { recursive: true });
            writeFileSync(join(path, 'package.json'), JSON.stringify(pkg));

            return path;
        }

        it('should return null for a non-package directory', () => {
            const path = join(dir, 'not-a-package');

            mkdirSync(path, { recursive: true });

            assert.equal(resolveServiceEntry(path), null);
        });

        it('should resolve via main field', () => {
            const path = pkgDir('with-main', { main: 'lib/entry.js' });
            const entry = resolveServiceEntry(path);

            assert.ok(entry);
            assert.equal(fileURLToPath(entry), join(path, 'lib', 'entry.js'));
        });

        it('should prefer the exports map over main', () => {
            const path = pkgDir('with-exports', {
                main: 'wrong.js',
                exports: { '.': { import: './right.js' } },
            });

            assert.equal(
                fileURLToPath(resolveServiceEntry(path) as string),
                join(path, 'right.js'),
            );
        });

        it('should support a string-valued exports dot entry', () => {
            const path = pkgDir('with-string-exports', {
                exports: { '.': './entry.mjs' },
            });

            assert.equal(
                fileURLToPath(resolveServiceEntry(path) as string),
                join(path, 'entry.mjs'),
            );
        });

        it('should fall back to index.js without main or exports', () => {
            const path = pkgDir('bare', { name: 'bare' });

            assert.equal(
                fileURLToPath(resolveServiceEntry(path) as string),
                join(path, 'index.js'),
            );
        });
    });
});
