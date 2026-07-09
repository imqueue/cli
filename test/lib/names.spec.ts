/*!
 * IMQ-CLI Unit Tests: fs
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
import { dashed, camelCase } from '../../lib/index.js';

describe('names', () => {
    describe('dashed()', () => {
        it('should be a function', () => {
            assert.equal(typeof dashed, 'function');
        });

        it('should properly transform given name to dashed string', () => {
            assert.equal(dashed('camelCase'), 'camel-case');
            assert.equal(dashed('CamelCase'), 'camel-case');
            assert.equal(dashed('Camel-Case'), 'camel-case');
            assert.equal(dashed('Camel_Case'), 'camel-case');
            assert.equal(dashed('_camelCase'), '-camel-case');
            assert.equal(dashed('-CamelCase'), '-camel-case');
            assert.equal(dashed(' CamelCase'), 'camel-case');
            assert.equal(dashed(' CamelCase '), 'camel-case');
        });
    });

    describe('camelCase()', () => {
        it('should be a function', () => {
            assert.equal(typeof camelCase, 'function');
        });

        it('should properly transform given name to dashed string', () => {
            assert.equal(camelCase('camel-case'), 'CamelCase');
            assert.equal(camelCase('-camel-case'), '-CamelCase');
            assert.equal(camelCase(' camel-case'), 'CamelCase');
            assert.equal(camelCase(' camel-case '), 'CamelCase');
            assert.equal(camelCase('camel_case/string'), 'CamelCaseString');
        });
    });
});
