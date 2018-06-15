/*!
 * IMQ-CLI Unit Tests: fs
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
import * as fs from 'fs';
import { uuid } from '@imqueue/rpc';
import * as p from 'path';
import { mkdirp, touch, rmdir, cpr } from '../../lib';

const TEMP_DIR: string = p.resolve('.', '.imq-cli-test');

describe('fs', () => {
    before(() => { fs.mkdirSync(TEMP_DIR) });
    after(() => { try { rmdir(TEMP_DIR) } catch (e) {} });

    describe('cpr()', () => {
        it('should be a function', () => {
            expect(typeof cpr).equals('function');
        });

        it('should copy directory contents recursively', () => {
            const src = p.resolve(TEMP_DIR, uuid());
            const dst = p.resolve(TEMP_DIR, uuid());

            fs.mkdirSync(src);
            fs.mkdirSync(p.resolve(src, 'dir'));
            fs.writeFileSync(p.resolve(src, 'file'), '');
            fs.writeFileSync(p.resolve(src, 'dir/file'), '');

            cpr(src, dst);

            expect(fs.statSync(dst).isDirectory()).to.be.true;
            expect(fs.statSync(p.resolve(dst, 'dir')).isDirectory()).to.be.true;
            expect(fs.statSync(p.resolve(dst, 'file')).isFile()).to.be.true;
            expect(fs.statSync(p.resolve(dst, 'dir/file')).isFile()).to.be.true;
        });

        it('should copy properly', () => {
            const src = p.resolve(TEMP_DIR, uuid());
            const dst = p.resolve(TEMP_DIR, uuid());

            fs.mkdirSync(src);
            fs.mkdirSync(dst);
            fs.mkdirSync(p.resolve(src, 'dir'));
            fs.writeFileSync(p.resolve(src, 'file'), '');
            fs.writeFileSync(p.resolve(src, 'dir/file'), '');

            cpr(src, dst);

            expect(fs.statSync(dst).isDirectory()).to.be.true;
            expect(fs.statSync(p.resolve(dst, 'dir')).isDirectory()).to.be.true;
            expect(fs.statSync(p.resolve(dst, 'file')).isFile()).to.be.true;
            expect(fs.statSync(p.resolve(dst, 'dir/file')).isFile()).to.be.true;
        });
    });

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

    describe('rmdir()', () => {
        it('should be a function', () => {
            expect(typeof rmdir).equals('function');
        });

        it('should remove directory with all it contents', () => {
            const target = p.resolve(TEMP_DIR, uuid());
            const file = p.resolve(target, uuid());
            const dir = p.resolve(target, uuid());
            const dirFile = p.resolve(dir, uuid());
            const dirDir = p.resolve(dir, uuid());

            fs.mkdirSync(target);
            fs.writeFileSync(file, '');
            fs.mkdirSync(dir);
            fs.mkdirSync(dirDir);
            fs.writeFileSync(dirFile, '');

            rmdir(target);

            expect(fs.existsSync(dirDir)).to.be.false;
            expect(fs.existsSync(dirFile)).to.be.false;
            expect(fs.existsSync(dir)).to.be.false;
            expect(fs.existsSync(file)).to.be.false;
            expect(fs.existsSync(target)).to.be.false;
        });
    });
});
