/*!
 * IMQ-CLI Unit Tests: node
 *
 * I'm Queue Software Project
 * Copyright (C) 2025  imqueue.com <support@imqueue.com>
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
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../mocks/index.js';
import * as node from '../../lib/node.js';

describe('node', () => {
    describe('semverCompare()', () => {
        it('should be a function', () => {
            assert.equal(typeof node.semverCompare, 'function');
        });

        it('should perform comparison properly', () => {
            assert.equal(node.semverCompare('0.0.0', '0.0.0'), 0);
            assert.equal(node.semverCompare('1.0.0', '1.0.0'), 0);
            assert.equal(node.semverCompare('1.2.10', '1.2.10'), 0);
            assert.equal(node.semverCompare('3.4.5', '3.4.5'), 0);
            assert.equal(node.semverCompare('1.0.1', '1.0.0'), -1);
            assert.equal(node.semverCompare('1.1.1', '1.0.1'), -1);
            assert.equal(node.semverCompare('0.0.1', '0.0.0'), -1);
            assert.equal(node.semverCompare('10.0.0', '1.0.0'), -1);
            assert.equal(node.semverCompare('0.0.0', '2.0.0'), 1);
            assert.equal(node.semverCompare('1.0.0', '2.0.0'), 1);
            assert.equal(node.semverCompare('1.0.1', '1.1.0'), 1);
            assert.equal(node.semverCompare('1.0.0', '10.0.0'), 1);
        });
    });

    describe('getNodeVersions()', () => {
        it('should be a function', () => {
            assert.equal(typeof node.getNodeVersions, 'function');
        });

        it('should return node versions', async () => {
            const versions = await node.getNodeVersions();
            assert.ok(versions instanceof Array);
            assert.equal(typeof versions[0].version, 'string');
            assert.match(versions[0].version, /^v\d+\.\d+\.\d+$/);
        });
    });

    describe('nodeVersion()', () => {
        it('should be a function', () => {
            assert.equal(typeof node.nodeVersion, 'function');
        });

        it('should return proper version for given tag', async () => {
            const versions = await node.getNodeVersions();
            const lts: any = versions.find(v => !!v.lts);
            const max10: any = versions.find(v => v.version.startsWith('v10'));
            const max43: any = versions.find(v => /v4\.3/.test(v.version));

            assert.equal(
                'v' + (await node.nodeVersion('latest')),
                versions[0].version,
            );
            assert.equal(
                'v' + (await node.nodeVersion('node')),
                versions[0].version,
            );
            assert.equal('v' + (await node.nodeVersion('stable')), lts.version);
            assert.equal('v' + (await node.nodeVersion('lts')), lts.version);
            assert.equal('v' + (await node.nodeVersion('lts/*')), lts.version);
            assert.equal('v' + (await node.nodeVersion('10')), max10.version);
            assert.equal('v' + (await node.nodeVersion('4.3')), max43.version);
        });
    });

    describe('toTravisTags()', () => {
        it('should be a function', () => {
            assert.equal(typeof node.toTravisTags, 'function');
        });

        it('should return valid tags converted', async () => {
            assert.deepEqual(await node.toTravisTags(''), []);
            assert.deepEqual(await node.toTravisTags('node'), ['node']);
            assert.deepEqual(await node.toTravisTags(['latest', 'stable']), [
                'node',
                'lts/*',
            ]);
            assert.deepEqual(
                await node.toTravisTags(['latest', 'stable', 'lts']),
                ['node', 'lts/*'],
            );
            assert.deepEqual(await node.toTravisTags('lts/*'), ['lts/*']);
        });
    });
});
