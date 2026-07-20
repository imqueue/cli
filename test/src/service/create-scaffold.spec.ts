/*!
 * IMQ-CLI Unit Tests: service create scaffolding
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
import {
    existsSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
    isEsmService,
    loadTemplateManifest,
    overlayFragments,
    removeDockerFiles,
    resolveLicense,
} from '../../../src/service/create-scaffold.js';

describe('service create scaffolding', () => {
    const dir = mkdtempSync(join(tmpdir(), 'imq-scaffold-'));

    after(() => rmSync(dir, { recursive: true, force: true }));

    describe('loadTemplateManifest()', () => {
        it('should return null when no manifest exists', () => {
            assert.equal(loadTemplateManifest(dir), null);
        });

        it('should parse a present manifest', () => {
            writeFileSync(
                join(dir, 'imq-template.json'),
                JSON.stringify({ version: 2 }),
            );
            assert.equal(loadTemplateManifest(dir)?.version, 2);
        });
    });

    describe('isEsmService()', () => {
        it('should detect type=module', () => {
            writeFileSync(
                join(dir, 'package.json'),
                JSON.stringify({ type: 'module' }),
            );
            assert.equal(isEsmService(dir), true);
        });

        it('should be false for commonjs / missing package.json', () => {
            writeFileSync(join(dir, 'package.json'), JSON.stringify({}));
            assert.equal(isEsmService(dir), false);
        });
    });

    describe('overlayFragments()', () => {
        it('should write fragments creating nested dirs', () => {
            overlayFragments(dir, [
                { relPath: '.travis.yml', content: 'ci: yes' },
                { relPath: '.github/workflows/build.yml', content: 'gha: yes' },
            ]);

            assert.equal(
                readFileSync(join(dir, '.travis.yml'), 'utf8'),
                'ci: yes',
            );
            assert.equal(
                readFileSync(join(dir, '.github/workflows/build.yml'), 'utf8'),
                'gha: yes',
            );
        });
    });

    describe('removeDockerFiles()', () => {
        it('should remove Dockerfile and .dockerignore only', () => {
            writeFileSync(join(dir, 'Dockerfile'), 'FROM node');
            writeFileSync(join(dir, '.dockerignore'), 'node_modules');
            removeDockerFiles(dir);

            assert.equal(existsSync(join(dir, 'Dockerfile')), false);
            assert.equal(existsSync(join(dir, '.dockerignore')), false);
        });
    });

    describe('resolveLicense()', () => {
        it('should build UNLICENSED header/text', () => {
            const lic = resolveLicense(
                'UNLICENSED',
                'Me',
                'me@x.io',
                '',
                'svc',
            );

            assert.equal(lic.tag, 'UNLICENSED');
            assert.match(lic.header, /unlicensed/i);
        });

        it('should resolve a known SPDX license', () => {
            const lic = resolveLicense('MIT', 'Me', 'me@x.io', '', 'svc');

            assert.equal(lic.tag, 'MIT');
            assert.match(lic.text, /MIT/);
        });

        it('should throw on an unknown license', () => {
            assert.throws(
                () =>
                    resolveLicense(
                        'definitely-not-a-license',
                        'M',
                        'm@x',
                        '',
                        's',
                    ),
                /Unknown license/,
            );
        });
    });
});
