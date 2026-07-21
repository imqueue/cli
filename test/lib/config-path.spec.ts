/*!
 * @imqueue/cli Unit Tests: config-path
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
import '../mocks/index.js';
import { getPath, setPath, hasPath } from '../../lib/index.js';

describe('config-path', () => {
    describe('getPath()', () => {
        it('should read a plain (dot-free) key like before', () => {
            assert.equal(getPath({ author: 'me' }, 'author'), 'me');
        });

        it('should read a nested value by dot-path', () => {
            const cfg = { ci: { provider: 'circleci' } };

            assert.equal(getPath(cfg, 'ci.provider'), 'circleci');
        });

        it('should return undefined for a missing segment', () => {
            assert.equal(getPath({ ci: {} }, 'ci.provider'), undefined);
            assert.equal(getPath({}, 'a.b.c'), undefined);
        });

        it('should not throw when traversing through a non-object', () => {
            assert.equal(getPath({ a: 5 }, 'a.b.c'), undefined);
        });
    });

    describe('hasPath()', () => {
        it('should report presence of a defined value', () => {
            assert.equal(
                hasPath({ vcs: { provider: 'github' } }, 'vcs.provider'),
                true,
            );
            assert.equal(hasPath({ vcs: {} }, 'vcs.provider'), false);
        });
    });

    describe('setPath()', () => {
        it('should set a plain key like before', () => {
            const cfg: any = {};

            setPath(cfg, 'author', 'me');
            assert.equal(cfg.author, 'me');
        });

        it('should create intermediate objects for a dot-path', () => {
            const cfg: any = {};

            setPath(cfg, 'registry.auth.user', 'bob');
            assert.deepEqual(cfg, { registry: { auth: { user: 'bob' } } });
        });

        it('should overwrite a non-object intermediate', () => {
            const cfg: any = { ci: 'x' };

            setPath(cfg, 'ci.provider', 'travis');
            assert.deepEqual(cfg, { ci: { provider: 'travis' } });
        });

        it('should preserve sibling keys', () => {
            const cfg: any = { ci: { provider: 'travis' } };

            setPath(cfg, 'ci.enabled', true);
            assert.deepEqual(cfg, {
                ci: { provider: 'travis', enabled: true },
            });
        });
    });
});
