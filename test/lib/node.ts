/*!
 * IMQ-CLI Unit Tests: node
 *
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
 */
import '../mocks';
import { expect } from 'chai';
import * as node from '../../lib/node';

describe('node', () => {
    describe('semverCompare()', () => {
        it('should be a function', () => {
            expect(typeof node.semverCompare).equals('function');
        });

        it('should perform comparison properly', () => {
            expect(node.semverCompare('0.0.0', '0.0.0')).equals(0);
            expect(node.semverCompare('1.0.0', '1.0.0')).equals(0);
            expect(node.semverCompare('1.2.10', '1.2.10')).equals(0);
            expect(node.semverCompare('3.4.5', '3.4.5')).equals(0);
            expect(node.semverCompare('1.0.1', '1.0.0')).equals(-1);
            expect(node.semverCompare('1.1.1', '1.0.1')).equals(-1);
            expect(node.semverCompare('0.0.1', '0.0.0')).equals(-1);
            expect(node.semverCompare('10.0.0', '1.0.0')).equals(-1);
            expect(node.semverCompare('0.0.0', '2.0.0')).equals(1);
            expect(node.semverCompare('1.0.0', '2.0.0')).equals(1);
            expect(node.semverCompare('1.0.1', '1.1.0')).equals(1);
            expect(node.semverCompare('1.0.0', '10.0.0')).equals(1);
        });
    });

    describe('getNodeVersions()', () => {
        it('should be a function', () => {
            expect(typeof node.getNodeVersions).equals('function');
        });

        it('should return node versions', async () => {
            const versions = await node.getNodeVersions();
            expect(versions).instanceof(Array);
            expect(versions[0].version).to.be.string;
            expect(versions[0].version).match(/^v\d+\.\d+\.\d+$/);
        });
    });

    describe('nodeVersion()', () => {
        it('should be a function', () => {
            expect(typeof node.nodeVersion).equals('function');
        });

        it('should return proper version for given tag', async () => {
            const versions = await node.getNodeVersions();
            const lts: any = versions.find(v => !!v.lts);
            const max10: any = versions.find(v => /^v10/.test(v.version));
            const max43: any = versions.find(v => /v4\.3/.test(v.version));

            expect('v' + await node.nodeVersion('latest'))
                .equals(versions[0].version);
            expect('v' + await node.nodeVersion('node'))
                .equals(versions[0].version);
            expect('v' + await node.nodeVersion('stable')).equals(lts.version);
            expect('v' + await node.nodeVersion('lts')).equals(lts.version);
            expect('v' + await node.nodeVersion('lts/*')).equals(lts.version);
            expect('v' + await node.nodeVersion('10')).equals(max10.version);
            expect('v' + await node.nodeVersion('4.3')).equals(max43.version);
        });
    });

    describe('toTravisTags()', () => {
        it('should be a function', () => {
            expect(typeof node.toTravisTags).equals('function');
        });

        it('should return valid tags converted', async () => {
            expect(await node.toTravisTags('')).eqls([]);
            expect(await node.toTravisTags('node')).eqls(['node']);
            expect(await node.toTravisTags(['latest', 'stable']))
                .eqls(['node', 'lts/*']);
            expect(await node.toTravisTags(['latest', 'stable', 'lts']))
                .eqls(['node', 'lts/*']);
            expect(await node.toTravisTags('lts/*')).eqls(['lts/*']);
        });
    });
});
