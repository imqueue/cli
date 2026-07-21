/*!
 * @imqueue/cli Unit Tests: service create plan builder
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

            assert.equal(plan.description, 'svc2 - @imqueue based service');
        });
    });

    describe('buildCreatePlan() resolution precedence (review phase C)', () => {
        const argvNoLicense = { name: 'svc2', path: '/tmp/imq-plan-test' };

        it('should let a per-service license win over the global one', async () => {
            const plan = await buildCreatePlan(argvNoLicense, {
                global: { ...legacyConfig, license: 'MIT' },
                service: { license: 'Apache-2.0' },
                interactive: false,
                dryRun: true,
            });

            assert.equal(plan.license.tag, 'Apache-2.0');
        });

        it('should honor --no-use-git over a configured useGit:true', async () => {
            const plan = await buildCreatePlan(
                { ...baseArgv, g: false },
                {
                    global: legacyConfig,
                    service: {},
                    interactive: false,
                    dryRun: true,
                },
            );

            assert.equal(plan.useVcs, false);
        });

        it('should deep-merge a partial .imqrc.json over global vcs', async () => {
            // a partial service vcs override must keep the global provider,
            // namespace and token rather than wiping the whole section
            const plan = await buildCreatePlan(baseArgv, {
                global: {
                    author: 'A',
                    email: 'a@b.io',
                    vcs: {
                        provider: 'github',
                        namespace: 'globalns',
                        auth: { token: 'ghp_x' },
                    },
                },
                service: { vcs: { private: false } },
                interactive: false,
                dryRun: true,
            });

            assert.equal(plan.config.vcs.provider, 'github');
            assert.equal(plan.config.vcs.namespace, 'globalns');
            assert.equal(plan.config.vcs.private, false);
            assert.equal(plan.config.vcs.auth?.token, 'ghp_x');
        });

        it('should NOT reuse a legacy github token for a gitlab host', async () => {
            // a real (non-dry-run) create: with the github token cleared for the
            // gitlab host and no gitlab token supplied, resolution must fail on
            // the missing token rather than silently reusing the github one
            await assert.rejects(
                () =>
                    buildCreatePlan(
                        {
                            ...baseArgv,
                            vcs: 'gitlab',
                            u: 'myorg',
                            ci: 'circleci',
                        },
                        {
                            global: legacyConfig,
                            service: {},
                            interactive: false,
                            dryRun: false,
                        },
                    ),
                /GitLab auth token required/,
            );
        });

        it('should not demand credentials under --dry-run', async () => {
            // a dry run makes no calls, so it must preview the plan without a
            // real namespace/token (the documented CI-safe behavior)
            const plan = await buildCreatePlan(
                {
                    ...baseArgv,
                    author: 'J',
                    email: 'j@d.io',
                    vcs: 'gitlab',
                    ci: 'circleci',
                },
                { global: {}, service: {}, interactive: false, dryRun: true },
            );

            assert.equal(plan.config.vcs.provider, 'gitlab');
        });
    });

    describe('buildCreatePlan() git protocol resolution', () => {
        it('should default the push protocol to https', async () => {
            const plan = await buildCreatePlan(baseArgv, {
                global: legacyConfig,
                service: {},
                interactive: false,
                dryRun: true,
            });

            assert.equal(plan.config.vcs.protocol, 'https');
        });

        it('should let --git-protocol ssh win over the default', async () => {
            const plan = await buildCreatePlan(
                { ...baseArgv, gitProtocol: 'ssh' },
                {
                    global: legacyConfig,
                    service: {},
                    interactive: false,
                    dryRun: true,
                },
            );

            assert.equal(plan.config.vcs.protocol, 'ssh');
        });

        it('should honor a configured vcs.protocol', async () => {
            const plan = await buildCreatePlan(baseArgv, {
                global: { ...legacyConfig, vcs: { protocol: 'ssh' } },
                service: {},
                interactive: false,
                dryRun: true,
            });

            assert.equal(plan.config.vcs.protocol, 'ssh');
        });

        it('should let a per-service protocol override the global', async () => {
            const plan = await buildCreatePlan(baseArgv, {
                global: { ...legacyConfig, vcs: { protocol: 'ssh' } },
                service: { vcs: { protocol: 'https' } },
                interactive: false,
                dryRun: true,
            });

            assert.equal(plan.config.vcs.protocol, 'https');
        });

        it('should reject an invalid protocol value', async () => {
            await assert.rejects(
                () =>
                    buildCreatePlan(
                        { ...baseArgv, gitProtocol: 'ftp' },
                        {
                            global: legacyConfig,
                            service: {},
                            interactive: false,
                            dryRun: true,
                        },
                    ),
                /Invalid git protocol/,
            );
        });
    });
});
