/*!
 * IMQ-CLI Unit Tests: service create plan builder
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
import { buildCreatePlan } from '../../../src/service/create-plan.js';

const legacyConfig = {
    author: 'Org Inc',
    email: 'support@org.io',
    useGit: true,
    gitBaseUrl: 'git@github.com:imqueue',
    gitHubAuthToken: 'ghp_token',
    gitRepoPrivate: true,
    useDocker: true,
    dockerHubNamespace: 'imqueue',
    dockerHubUser: 'bob',
    dockerHubPassword: 'secret',
};

const baseArgv = { name: 'svc2', path: '/tmp/imq-plan-test', license: 'MIT' };

describe('service create plan', () => {
    describe('buildCreatePlan() from a v3 legacy config', () => {
        it('should reproduce the github/travis/dockerhub selection', async () => {
            const plan = await buildCreatePlan(baseArgv, {
                global: legacyConfig,
                service: {},
                interactive: false,
                dryRun: true,
            });

            assert.equal(plan.name, 'svc2');
            assert.equal(plan.className, 'Svc2');
            assert.equal(plan.useVcs, true);
            assert.equal(plan.config.vcs.provider, 'github');
            assert.equal(plan.config.vcs.namespace, 'imqueue');
            assert.equal(plan.config.vcs.private, true);
            assert.equal(plan.config.vcs.auth?.token, 'ghp_token');
            assert.equal(plan.config.ci.provider, 'travis');
            assert.equal(plan.dockerize, true);
            assert.equal(plan.config.registry.provider, 'dockerhub');
            assert.equal(plan.config.registry.namespace, 'imqueue');
            assert.deepEqual(plan.nodeTags, ['lts/*', 'node']);
            assert.equal(plan.license.tag, 'MIT');
        });

        it('should let a per-service config override the global', async () => {
            const plan = await buildCreatePlan(baseArgv, {
                global: legacyConfig,
                service: { vcs: { namespace: 'other-org' } },
                interactive: false,
                dryRun: true,
            });

            assert.equal(plan.config.vcs.namespace, 'other-org');
        });
    });

    describe('buildCreatePlan() with an empty config', () => {
        it('should disable git and docker non-interactively', async () => {
            const plan = await buildCreatePlan(
                { ...baseArgv, author: 'Jane', email: 'jane@dev.io' },
                { global: {}, service: {}, interactive: false, dryRun: true },
            );

            assert.equal(plan.useVcs, false);
            assert.equal(plan.dockerize, false);
            assert.equal(plan.config.vcs.provider, undefined);
            assert.equal(plan.config.registry.provider, undefined);
        });

        it('should require an email non-interactively', async () => {
            await assert.rejects(
                () =>
                    buildCreatePlan(baseArgv, {
                        global: {},
                        service: {},
                        interactive: false,
                        dryRun: true,
                    }),
                /email is required/,
            );
        });
    });

    describe('buildCreatePlan() flag handling', () => {
        it('should honor --no-install and the negated install=false', async () => {
            const a = await buildCreatePlan(
                { ...baseArgv, author: 'J', email: 'j@d.io', install: false },
                { global: {}, service: {}, interactive: false, dryRun: true },
            );

            assert.equal(a.noInstall, true);
        });

        it('should derive description when none is given', async () => {
            const plan = await buildCreatePlan(
                { ...baseArgv, author: 'J', email: 'j@d.io' },
                { global: {}, service: {}, interactive: false, dryRun: true },
            );

            assert.equal(plan.description, 'svc2 - IMQ based service');
        });
    });
});
