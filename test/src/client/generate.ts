/*!
 * IMQ-CLI Unit Tests: client generate
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
import '../../mocks';
import { expect } from 'chai';
import * as client from '../../../src/client/generate';

describe('client generate', () => {
    it('should be a valid command definition', () => {
        expect(typeof client.command).equals('string');
        expect(client.command).contains('generate');
        expect(typeof client.describe).equals('string');
        expect(client.describe).not.to.be.empty;
        expect(typeof client.handler).equals('function');
    });
});
