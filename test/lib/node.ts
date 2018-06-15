/*!
 * IMQ-CLI Unit Tests: node
 *
 * Copyright (c) 2018, imqueue.com <support@imqueue.com>
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 * OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
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
