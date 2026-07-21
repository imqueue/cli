/*!
 * @imqueue/cli Unit Tests: .imqrc.json is written without secrets
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
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import '../../mocks/index.js';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeServiceConfig } from '../../../src/service/create-pipeline.js';

describe('writeServiceConfig()', () => {
    const dir = mkdtempSync(join(tmpdir(), 'imq-imqrc-'));

    after(() => rmSync(dir, { recursive: true, force: true }));

    it('should never persist secrets in .imqrc.json', () => {
        // a plan carrying every secret the resolvers can hold
        const plan = {
            path: dir,
            useVcs: true,
            config: {
                vcs: {
                    provider: 'github',
                    namespace: 'acme',
                    private: true,
                    protocol: 'ssh',
                    auth: { token: 'ghp_SUPER_SECRET' },
                },
                ci: { provider: 'circleci', auth: { token: 'circle-secret' } },
                registry: {
                    provider: 'dockerhub',
                    namespace: 'acme',
                    auth: { user: 'bob', password: 'hunter2' },
                },
                packages: ['pg-cache'],
                templatesRef: 'v4',
            },
        } as any;

        writeServiceConfig(plan);

        const raw = readFileSync(join(dir, '.imqrc.json'), 'utf8');
        const parsed = JSON.parse(raw);

        // structural expectations are preserved...
        assert.equal(parsed.vcs.provider, 'github');
        assert.equal(parsed.vcs.namespace, 'acme');
        assert.equal(parsed.vcs.protocol, 'ssh');
        assert.equal(parsed.ci.provider, 'circleci');
        assert.equal(parsed.registry.provider, 'dockerhub');
        assert.deepEqual(parsed.packages, ['pg-cache']);

        // ...but NO secret value or auth block leaks in, on any path
        assert.ok(!/ghp_SUPER_SECRET|circle-secret|hunter2|bob/.test(raw));
        assert.equal(parsed.vcs.auth, undefined);
        assert.equal(parsed.ci.auth, undefined);
        assert.equal(parsed.registry.auth, undefined);
    });
});
