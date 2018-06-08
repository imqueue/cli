/*!
 * IMQ-CLI Unit Tests: template
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
import {
    wrap,
    checkGit,
    loadTemplates,
    updateTemplates,
    loadTemplate,
} from '../../lib';

describe('template', () => {
    describe('wrap()', () => {
        const text = 'Lorem ipsum dolor sit amet, consectetur adipiscing ' +
            'elit, sed do eiusmod tempor incididunt ut labore et dolore ' +
            'magna aliqua. Ut enim ad minim veniam, quis nostrud ' +
            'exercitation ullamco laboris nisi ut aliquip ex ea ' +
            'commodo consequat. Duis aute irure dolor in reprehenderit ' +
            'in voluptate velit esse cillum dolore eu fugiat nulla ' +
            'pariatur. Excepteur sint occaecat cupidatat non proident, ' +
            'sunt in culpa qui officia deserunt mollit anim id est ' +
            'laborum.';

        it('should be a function', () => {
            expect(typeof wrap).equals('function');
        });

        it('should wrap text to 80 chars by default with no indent', () => {
            const wrappedLines = wrap(text).split(/\r?\n/);
            for (let line of wrappedLines) {
                expect(line.length).lte(80);
            }
        });

        it('should wrap text to given  of number chars with no indent', () => {
            const wrappedLines = wrap(text, 90, '').split(/\r?\n/);
            for (let line of wrappedLines) {
                expect(line.length).lte(90);
            }
        });

        it('should wrap text using given indentation', () => {
            const wrappedLines = wrap(text, 80, '     ').split(/\r?\n/);
            for (let line of wrappedLines) {
                expect(line.substr(0, 5)).equals('     ');
            }
        });
    });

    describe('checkGit()', () => {
        after(() => { (<any>global).checkGitResult = true });
        it('should be a function', () => {
            expect(typeof checkGit).equals('function');
        });

        it('should not throw if git command exists', () => {
            (<any>global).checkGitResult = true;
            expect(() => checkGit()).not.to.throw(Error);
        });

        it('should throw if git command does not exist', () => {
            (<any>global).checkGitResult = false;
            expect(() => checkGit()).throws(Error);
        });
    });

    describe('loadTemplates()', () => {
        it('should be a function', () => {
            expect(typeof loadTemplates).equals('function');
        });
    });

    describe('updateTemplates()', () => {
        it('should be a function', () => {
            expect(typeof updateTemplates).equals('function');
        });
    });

    describe('loadTemplate()', () => {
        it('should be a function', () => {
            expect(typeof loadTemplate).equals('function');
        });
    });
});
