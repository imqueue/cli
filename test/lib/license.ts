/*!
 * IMQ-CLI Unit Tests: license
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
import { findLicense } from '../../lib';

describe('license', function() {
    describe('findLicense()', () => {
        it('should be a function', () => {
            expect(typeof findLicense).equals('function');
        });

        it('should return license object if proper name given', () => {
            expect(findLicense('mit').spdx_id).equals('MIT');
            expect(findLicense('Mit').spdx_id).equals('MIT');
            expect(findLicense('mIt').spdx_id).equals('MIT');
            expect(findLicense('MIT').spdx_id).equals('MIT');
            expect(findLicense('mi').spdx_id).equals('MIT');
            expect(findLicense('mit license').spdx_id).equals('MIT');
        });

        it('should return null if nothing found', () => {
            expect(findLicense('dsjgiuewhd')).to.be.null;
        });
    });
});
