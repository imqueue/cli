/*!
 * @imqueue/cli Unit Tests: client generate
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
import '../../mocks/index.js';
import * as client from '../../../src/client/generate.js';

describe('client generate', () => {
    it('should be a valid command definition', () => {
        assert.equal(typeof client.command, 'string');
        assert.ok(client.command.includes('generate'));
        assert.equal(typeof client.describe, 'string');
        assert.notEqual(client.describe.length, 0);
        assert.equal(typeof client.handler, 'function');
    });
});
