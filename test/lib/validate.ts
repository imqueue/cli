/*!
 * IMQ-CLI Unit Tests: validate
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
import '../mocks';
import { expect } from "chai";
import { isEmail, isNamespace, isGuthubToken } from '../../lib';

describe('validate', function() {
    describe('isEmail()', () => {
        it('should be a function', () => {
            expect(typeof isEmail).equals('function');
        });

        it('should properly check given email string', () => {
            expect(isEmail('a@b')).equals(true);
            expect(isEmail('a.b@b.net')).equals(true);
            expect(isEmail('a-c0@b.dot')).equals(true);
            expect(isEmail('a#b')).equals(false);
            expect(isEmail('ab')).equals(false);
        });
    });

    describe('isNamespace()', () => {
        it('should be a function', () => {
            expect(typeof isNamespace).equals('function');
        });

        it('should properly check if a given string valid namespace', () => {
            expect(isNamespace('f57f%')).equals(false);
            expect(isNamespace('f57f')).equals(true);
            expect(isNamespace('djslkdj')).equals(true);
            expect(isNamespace('imqueue')).equals(true);
        });
    });
});
