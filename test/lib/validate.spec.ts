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
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../mocks/index.js';
import { isEmail, isNamespace, isGuthubToken } from '../../lib/index.js';

describe('validate', function () {
    describe('isEmail()', () => {
        it('should be a function', () => {
            assert.equal(typeof isEmail, 'function');
        });

        it('should properly check given email string', () => {
            assert.equal(isEmail('a@b'), true);
            assert.equal(isEmail('a.b@b.net'), true);
            assert.equal(isEmail('a-c0@b.dot'), true);
            assert.equal(isEmail('a#b'), false);
            assert.equal(isEmail('ab'), false);
        });
    });

    describe('isNamespace()', () => {
        it('should be a function', () => {
            assert.equal(typeof isNamespace, 'function');
        });

        it('should properly check if a given string valid namespace', () => {
            assert.equal(isNamespace('f57f%'), false);
            assert.equal(isNamespace('f57f'), true);
            assert.equal(isNamespace('djslkdj'), true);
            assert.equal(isNamespace('imqueue'), true);
        });
    });
});
