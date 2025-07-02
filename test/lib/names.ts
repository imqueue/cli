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
import '../mocks';
import { expect } from 'chai';
import { dashed, camelCase } from '../../lib';

describe('names', () => {
    describe('dashed()', () => {
        it('should be a function', () => {
            expect(typeof dashed).equals('function');
        });

        it('should properly transform given name to dashed string', () => {
            expect(dashed('camelCase')).equals('camel-case');
            expect(dashed('CamelCase')).equals('camel-case');
            expect(dashed('Camel-Case')).equals('camel-case');
            expect(dashed('Camel_Case')).equals('camel-case');
            expect(dashed('_camelCase')).equals('-camel-case');
            expect(dashed('-CamelCase')).equals('-camel-case');
            expect(dashed(' CamelCase')).equals('camel-case');
            expect(dashed(' CamelCase ')).equals('camel-case');
        });
    });

    describe('camelCase()', () => {
        it('should be a function', () => {
            expect(typeof camelCase).equals('function');
        });

        it('should properly transform given name to dashed string', () => {
            expect(camelCase('camel-case')).equals('CamelCase');
            expect(camelCase('-camel-case')).equals('-CamelCase');
            expect(camelCase(' camel-case')).equals('CamelCase');
            expect(camelCase(' camel-case ')).equals('CamelCase');
            expect(camelCase('camel_case/string')).equals('CamelCaseString');
        });
    });
});
