/*!
 * IMQ-CLI Unit Tests: template
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
