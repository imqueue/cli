/*!
 * IMQ-CLI Unit Tests: providers registry
 *
 * I'm Queue Software Project
 * Copyright (C) 2026  imqueue.com <support@imqueue.com>
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
import { ProviderRegistry } from '../../../src/providers/registry.js';

describe('ProviderRegistry', () => {
    const make = () => {
        const reg = new ProviderRegistry<{ id: string; title: string }>('ci');

        reg.register({ id: 'travis', title: 'Travis CI' });
        reg.register({ id: 'circleci', title: 'CircleCI' });

        return reg;
    };

    it('should register and list providers in order', () => {
        assert.deepEqual(make().ids(), ['travis', 'circleci']);
    });

    it('should get a registered provider by id', () => {
        assert.equal(make().get('circleci').title, 'CircleCI');
    });

    it('should throw for an unknown id and list available ones', () => {
        assert.throws(
            () => make().get('jenkins'),
            /Unknown ci provider "jenkins".*travis, circleci/s,
        );
    });

    it('should tryGet without throwing', () => {
        assert.equal(make().tryGet('jenkins'), undefined);
        assert.equal(make().tryGet('travis')?.id, 'travis');
    });

    it('should report membership via has()', () => {
        const reg = make();

        assert.equal(reg.has('travis'), true);
        assert.equal(reg.has('jenkins'), false);
    });

    it('should let a later registration override an id', () => {
        const reg = make();

        reg.register({ id: 'travis', title: 'Travis (pro)' });
        assert.equal(reg.get('travis').title, 'Travis (pro)');
        assert.equal(reg.ids().length, 2);
    });
});
