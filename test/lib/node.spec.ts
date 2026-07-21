/*!
 * @imqueue/cli Unit Tests: node
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
import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import '../mocks/index.js';
import * as node from '../../lib/node.js';

// canned nodejs.org dist index so the suite is deterministic and offline-safe
const DIST = [
    { version: 'v4.3.2', lts: false },
    { version: 'v22.3.0', lts: false },
    { version: 'v20.11.1', lts: 'Iron' },
    { version: 'v10.24.1', lts: false },
];

function stubDist() {
    mock.method(
        globalThis,
        'fetch',
        async () => ({ ok: true, json: async () => DIST }) as any,
    );
}

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
        afterEach(() => mock.restoreAll());

        it('should be a function', () => {
            assert.equal(typeof node.getNodeVersions, 'function');
        });

        it('should return node versions sorted descending', async () => {
            stubDist();

            const versions = await node.getNodeVersions(true);

            assert.ok(versions instanceof Array);
            assert.match(versions[0].version, /^v\d+\.\d+\.\d+$/);
            assert.equal(versions[0].version, 'v22.3.0');
        });
    });

    describe('nodeVersion()', () => {
        afterEach(() => mock.restoreAll());

        it('should be a function', () => {
            assert.equal(typeof node.nodeVersion, 'function');
        });

        it('should return proper version for given tag', async () => {
            stubDist();
            // seed the cache with the stubbed dist so nodeVersion resolves
            await node.getNodeVersions(true);

            assert.equal(await node.nodeVersion('latest'), '22.3.0');
            assert.equal(await node.nodeVersion('node'), '22.3.0');
            assert.equal(await node.nodeVersion('stable'), '20.11.1');
            assert.equal(await node.nodeVersion('lts'), '20.11.1');
            assert.equal(await node.nodeVersion('lts/*'), '20.11.1');
            assert.equal(await node.nodeVersion('10'), '10.24.1');
            assert.equal(await node.nodeVersion('4.3'), '4.3.2');
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
