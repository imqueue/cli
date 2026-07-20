/*!
 * IMQ-CLI Unit Tests: builtin providers
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
import {
    registerBuiltinProviders,
    vcsHosts,
    scmTools,
    ciProviders,
    containerRegistries,
} from '../../../src/providers/index.js';
import { github } from '../../../src/providers/vcs/github.js';
import { dockerhub } from '../../../src/providers/registry/dockerhub.js';
import { travis } from '../../../src/providers/ci/travis.js';

const ctx: any = {
    name: 'my-svc',
    config: {
        vcs: { provider: 'github', namespace: 'imqueue' },
        registry: {
            provider: 'dockerhub',
            namespace: 'imqueue',
            auth: { user: 'bob', password: 'pw' },
        },
    },
    nodeTags: ['lts/*', 'node'],
    dockerize: false,
};

describe('builtin providers', () => {
    it('should register into every axis registry', () => {
        registerBuiltinProviders();

        assert.ok(vcsHosts.has('github'));
        assert.ok(scmTools.has('git'));
        assert.ok(ciProviders.has('travis'));
        assert.ok(containerRegistries.has('dockerhub'));
    });

    describe('github vcs host', () => {
        it('should build ssh, https, web and bugs urls', () => {
            assert.equal(
                github.remoteUrl('imqueue', 'my-svc'),
                'git@github.com:imqueue/my-svc.git',
            );
            assert.equal(
                github.remoteUrl('imqueue', 'my-svc', 'https'),
                'https://github.com/imqueue/my-svc.git',
            );
            assert.equal(
                github.webUrl('imqueue', 'my-svc'),
                'https://github.com/imqueue/my-svc',
            );
            assert.equal(
                github.bugsUrl('imqueue', 'my-svc'),
                'https://github.com/imqueue/my-svc/issues',
            );
        });
    });

    describe('dockerhub registry', () => {
        it('should build the image ref from namespace and name', () => {
            assert.equal(dockerhub.imageRef(ctx), 'imqueue/my-svc');
        });

        it('should expose docker secret specs and resolved secrets', () => {
            assert.deepEqual(
                dockerhub.secretSpecs(ctx).map(s => s.name),
                ['DOCKER_USER', 'DOCKER_PASS'],
            );
            assert.deepEqual(dockerhub.secrets(ctx), [
                { name: 'DOCKER_USER', value: 'bob' },
                { name: 'DOCKER_PASS', value: 'pw' },
            ]);
        });
    });

    describe('travis ci', () => {
        it('should support only github', () => {
            assert.deepEqual(travis.supportedVcs, ['github']);
        });

        it('should emit node tags and empty docker tokens when not dockerizing', async () => {
            const tokens = await travis.tokens(ctx);

            assert.equal(tokens.TRAVIS_NODE_TAG, '- lts/*\n- node');
            assert.equal(tokens.DOCKER_NAMESPACE, '');
            assert.equal(tokens.NODE_DOCKER_TAG, '');
            assert.equal(tokens.DOCKER_SECRETS, '');
        });
    });
});
