/*!
 * IMQ-CLI Unit Tests: fs
 *
 * Copyright (c) 2018, Mykhailo Stadnyk <mikhus@gmail.com>
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
import * as os from 'os';
import * as fs from 'fs';
import { uuid } from 'imq-rpc';
import * as p from 'path';
import { mkdirp, touch } from '../../lib';

const TEMP_DIR: string = p.resolve(os.tmpdir(), '.imq-cli-test');

describe('fs', () => {
    after(() => { try { fs.rmdirSync(TEMP_DIR) } catch (e) {} });

    describe('mkdirp()', () => {
        it('should be a function', () => {
            expect(typeof mkdirp).equals('function');
        });

        it('should create path recursively', () => {
            const dirOne = p.resolve(TEMP_DIR, uuid());
            const dirTwo = p.resolve(dirOne, uuid());

            mkdirp(dirTwo);

            expect(fs.existsSync(dirOne)).to.be.true;
            expect(fs.existsSync(dirTwo)).to.be.true;

            fs.rmdirSync(dirTwo);
            fs.rmdirSync(dirOne);
        });
    });

    describe('touch()', () => {
        it('should be a function', () => {
            expect(typeof touch).equals('function');
        });

        it('should create file if not exist', () => {
            const file = p.resolve(TEMP_DIR, uuid());

            touch(file, 'initial');
            touch(file, 'changed');

            expect(fs.existsSync(file)).to.be.true;
            expect(fs.readFileSync(file).toString()).equals('initial');
        });
    });
});
