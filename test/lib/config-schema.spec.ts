/*!
 * IMQ-CLI Unit Tests: config-schema
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
import { deriveStructured, applyStructured } from '../../lib/index.js';

describe('config-schema', () => {
    describe('deriveStructured() from a legacy config', () => {
        const legacy = {
            gitBaseUrl: 'git@github.com:imqueue',
            gitHubAuthToken: 'ghp_token',
            gitRepoPrivate: true,
            useDocker: true,
            dockerHubNamespace: 'imqueue',
            dockerHubUser: 'bob',
            dockerHubPassword: 'secret',
        };

        it('should derive the github vcs host and namespace', () => {
            const s = deriveStructured(legacy);

            assert.equal(s.vcs.provider, 'github');
            assert.equal(s.vcs.namespace, 'imqueue');
            assert.equal(s.vcs.private, true);
            assert.equal(s.vcs.auth?.token, 'ghp_token');
        });

        it('should derive travis as the legacy CI', () => {
            assert.equal(deriveStructured(legacy).ci.provider, 'travis');
        });

        it('should derive the dockerhub registry', () => {
            const s = deriveStructured(legacy);

            assert.equal(s.registry.provider, 'dockerhub');
            assert.equal(s.registry.namespace, 'imqueue');
            assert.equal(s.registry.auth?.user, 'bob');
            assert.equal(s.registry.auth?.password, 'secret');
        });

        it('should default packages to an empty array', () => {
            assert.deepEqual(deriveStructured(legacy).packages, []);
        });
    });

    describe('deriveStructured() precedence', () => {
        it('should let structured keys win over legacy ones', () => {
            const s = deriveStructured({
                gitBaseUrl: 'git@github.com:legacyns',
                ci: { provider: 'circleci' },
                vcs: { provider: 'gitlab', namespace: 'newns' },
            });

            assert.equal(s.ci.provider, 'circleci');
            assert.equal(s.vcs.provider, 'gitlab');
            assert.equal(s.vcs.namespace, 'newns');
        });

        it('should leave CI undefined for an empty config', () => {
            assert.equal(deriveStructured({}).ci.provider, undefined);
            assert.equal(deriveStructured({}).vcs.provider, undefined);
            assert.equal(deriveStructured({}).registry.provider, undefined);
        });
    });

    describe('applyStructured() dual-write', () => {
        it('should mirror structured values back into legacy keys', () => {
            const cfg: any = {};

            applyStructured(cfg, {
                vcs: {
                    provider: 'github',
                    namespace: 'imqueue',
                    private: false,
                    auth: { token: 'ghp_x' },
                },
                ci: { provider: 'github-actions' },
                registry: {
                    provider: 'dockerhub',
                    namespace: 'imqueue',
                    auth: { user: 'bob', password: 'pw' },
                },
                templatesRef: 'v4',
                packages: ['pg-cache'],
            });

            // legacy mirror
            assert.equal(cfg.gitBaseUrl, 'git@github.com:imqueue');
            assert.equal(cfg.gitHubAuthToken, 'ghp_x');
            assert.equal(cfg.gitRepoPrivate, false);
            assert.equal(cfg.useGit, true);
            assert.equal(cfg.useDocker, true);
            assert.equal(cfg.dockerHubNamespace, 'imqueue');
            assert.equal(cfg.dockerHubUser, 'bob');
            assert.equal(cfg.dockerHubPassword, 'pw');

            // structured section
            assert.equal(cfg.vcs.provider, 'github');
            assert.equal(cfg.registry.provider, 'dockerhub');
            assert.deepEqual(cfg.packages, ['pg-cache']);
        });

        it('should disable legacy flows for non-legacy providers', () => {
            const cfg: any = {};

            applyStructured(cfg, {
                vcs: { provider: 'gitlab', namespace: 'grp' },
                ci: { provider: 'circleci' },
                registry: { provider: 'aws-ecr', region: 'eu-central-1' },
                packages: [],
            });

            assert.equal(cfg.useGit, false);
            assert.equal(cfg.useDocker, false);
        });

        it('should round-trip through derive for a github/dockerhub setup', () => {
            const cfg: any = {};

            applyStructured(cfg, {
                vcs: {
                    provider: 'github',
                    namespace: 'imqueue',
                    private: true,
                    auth: { token: 't' },
                },
                ci: { provider: 'travis' },
                registry: {
                    provider: 'dockerhub',
                    namespace: 'imqueue',
                    auth: { user: 'u', password: 'p' },
                },
                packages: [],
            });

            const s = deriveStructured(cfg);

            assert.equal(s.vcs.provider, 'github');
            assert.equal(s.ci.provider, 'travis');
            assert.equal(s.registry.provider, 'dockerhub');
        });
    });
});
