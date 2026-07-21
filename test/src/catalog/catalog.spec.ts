/*!
 * @imqueue/cli Unit Tests: package catalog
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
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadCatalog } from '../../../src/catalog/load.js';
import {
    parsePackagesFlag,
    validateSelection,
} from '../../../src/catalog/resolve.js';
import {
    mergeDependencies,
    resolveAddons,
} from '../../../src/catalog/apply.js';

describe('package catalog', () => {
    const catalog = loadCatalog();

    describe('loadCatalog()', () => {
        it('should load the bundled catalog with expected groups', () => {
            assert.ok(catalog.groups.tracing.exclusive);
            assert.ok(catalog.groups.orm.exclusive);
            assert.equal(catalog.groups.features.exclusive, false);
            assert.ok(catalog.packages['dd-trace']);
            assert.ok(catalog.packages['pg-cache']);
        });
    });

    describe('parsePackagesFlag()', () => {
        it('should return null when not provided', () => {
            assert.equal(parsePackagesFlag(undefined), null);
        });

        it('should return [] for --no-packages', () => {
            assert.deepEqual(parsePackagesFlag(false), []);
        });

        it('should split a comma list', () => {
            assert.deepEqual(parsePackagesFlag('dd-trace, pg-cache'), [
                'dd-trace',
                'pg-cache',
            ]);
        });
    });

    describe('validateSelection()', () => {
        it('should accept a valid mixed selection', () => {
            assert.deepEqual(
                validateSelection(['dd-trace', 'pg-cache', 'job'], catalog),
                ['dd-trace', 'pg-cache', 'job'],
            );
        });

        it('should dedupe', () => {
            assert.deepEqual(
                validateSelection(['pg-cache', 'pg-cache'], catalog),
                ['pg-cache'],
            );
        });

        it('should reject an unknown package', () => {
            assert.throws(
                () => validateSelection(['nope'], catalog),
                /Unknown package "nope"/,
            );
        });

        it('should reject two members of an exclusive group', () => {
            assert.throws(
                () => validateSelection(['dd-trace', 'opentelemetry'], catalog),
                /Only one "Tracing \/ APM" package/,
            );
        });
    });

    describe('resolveAddons()', () => {
        it('should aggregate deps, snippets, env and instructions', () => {
            const addons = resolveAddons(['dd-trace', 'pg-cache'], catalog);

            assert.equal(addons.deps['@imqueue/dd-trace'], '*');
            assert.equal(addons.deps['@imqueue/pg-cache'], '*');
            assert.match(addons.preload, /@imqueue\/dd-trace/);
            assert.ok(addons.hasSnippets);
            assert.ok(addons.env.includes('DD_AGENT_HOST'));
            assert.ok(addons.instructions.length > 0);
        });

        it('should report no snippets for deps-only selections', () => {
            const addons = resolveAddons(['pg-cache'], catalog);

            assert.equal(addons.hasSnippets, false);
            assert.equal(addons.preload, '');
        });

        it('should merge prisma dev dependencies', () => {
            const addons = resolveAddons(['prisma'], catalog);

            assert.equal(addons.devDeps['prisma'], '*');
            assert.equal(addons.deps['@prisma/client'], '*');
        });

        it('should skip an unknown package id instead of throwing', () => {
            // guards the plan-time vs pipeline catalog mismatch (review F26)
            const addons = resolveAddons(
                ['pg-cache', 'not-a-real-addon'],
                catalog,
            );

            assert.equal(addons.deps['@imqueue/pg-cache'], '*');
            assert.equal(addons.deps['@imqueue/not-a-real-addon'], undefined);
        });
    });

    describe('mergeDependencies()', () => {
        const dir = mkdtempSync(join(tmpdir(), 'imq-cat-'));

        after(() => rmSync(dir, { recursive: true, force: true }));

        it('should merge into package.json dependencies', () => {
            writeFileSync(
                join(dir, 'package.json'),
                JSON.stringify({ dependencies: { existing: '1.0.0' } }),
            );
            mergeDependencies(dir, { '@imqueue/job': '*' }, { prisma: '*' });

            const pkg = JSON.parse(
                readFileSync(join(dir, 'package.json'), 'utf8'),
            );

            assert.equal(pkg.dependencies.existing, '1.0.0');
            assert.equal(pkg.dependencies['@imqueue/job'], '*');
            assert.equal(pkg.devDependencies.prisma, '*');
        });
    });
});
