/*!
 * @imqueue/cli Unit Tests: license
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
import { findLicense } from '../../lib/index.js';

describe('license', function () {
    describe('findLicense()', () => {
        it('should be a function', () => {
            assert.equal(typeof findLicense, 'function');
        });

        it('should return license object if proper name given', () => {
            assert.equal(findLicense('mit').spdx_id, 'MIT');
            assert.equal(findLicense('Mit').spdx_id, 'MIT');
            assert.equal(findLicense('mIt').spdx_id, 'MIT');
            assert.equal(findLicense('MIT').spdx_id, 'MIT');
            assert.equal(findLicense('mi').spdx_id, 'MIT');
            assert.equal(findLicense('mit license').spdx_id, 'MIT');
        });

        it('should return null if nothing found', () => {
            assert.equal(findLicense('dsjgiuewhd'), null);
        });
    });
});
