/*!
 * IMQ-CLI Unit Tests: config init prompt wiring
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
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import '../../mocks/index.js';

// queue-based inquirer mock: each prompt() call shifts the next canned answer.
// Mocked before importing init so its default-export `prompt` wires correctly
// (regression: init used a namespace import whose `.prompt` was undefined).
const queue: any[] = [];

mock.module('inquirer', {
    defaultExport: {
        prompt: async () => (queue.length ? queue.shift() : {}),
        registerPrompt: () => undefined,
    },
});

const init: any = await import('../../../src/config/init.js');

describe('config init prompt wiring', () => {
    beforeEach(() => {
        queue.length = 0;
    });

    it('should store the prompted author and email', async () => {
        const config: any = {};

        queue.push({ author: 'My Org' });
        await init.authorName(config);
        queue.push({ email: 'dev@example.io' });
        await init.authorEmail(config);

        assert.equal(config.author, 'My Org');
        assert.equal(config.email, 'dev@example.io');
    });

    it('should pick a CI provider compatible with the vcs host', async () => {
        const config: any = { vcs: { provider: 'github' } };

        queue.push({ provider: 'circleci' });
        await init.ciOptions(config);

        assert.equal(config.ci.provider, 'circleci');
    });

    it('should resolve a non-github vcs host generically', async () => {
        const config: any = {};

        queue.push({ provider: 'gitlab' });
        queue.push({ namespace: 'my-group', token: 'glpat', isPrivate: true });
        await init.vcsHostOptions(config);

        assert.equal(config.vcs.provider, 'gitlab');
        assert.equal(config.vcs.namespace, 'my-group');
        assert.equal(config.vcs.auth.token, 'glpat');
        assert.equal(config.useGit, true);
    });

    it('should resolve a registry with its options', async () => {
        const config: any = {};

        queue.push({ useDocker: true });
        queue.push({ provider: 'dockerhub' });
        queue.push({ v: 'myns' }); // namespace option
        queue.push({ save: false });
        await init.registryOptions(config);

        assert.equal(config.useDocker, true);
        assert.equal(config.registry.provider, 'dockerhub');
        assert.equal(config.registry.namespace, 'myns');
    });

    it('should skip dockerization when declined', async () => {
        const config: any = {};

        queue.push({ useDocker: false });
        await init.registryOptions(config);

        assert.equal(config.useDocker, false);
        assert.equal(config.registry, undefined);
    });

    it('should collect a valid package selection across groups', async () => {
        const config: any = {};

        queue.push({ sel: 'dd-trace' }); // tracing (exclusive)
        queue.push({ sel: '' }); // orm (none)
        queue.push({ sel: ['pg-cache', 'job'] }); // features
        await init.packageOptions(config);

        assert.deepEqual(config.packages, ['dd-trace', 'pg-cache', 'job']);
    });
});
