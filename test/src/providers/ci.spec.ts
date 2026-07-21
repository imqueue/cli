/*!
 * @imqueue/cli Unit Tests: CI providers (github-actions, circleci)
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
import { afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import '../../mocks/index.js';
import { registerBuiltinProviders } from '../../../src/providers/index.js';
import { githubActions } from '../../../src/providers/ci/github-actions.js';
import { circleci } from '../../../src/providers/ci/circleci.js';

registerBuiltinProviders();

function baseCtx(dockerize: boolean): any {
    return {
        name: 'my-svc',
        nodeTags: ['lts/*', 'node'],
        dockerize,
        config: {
            vcs: {
                provider: 'github',
                namespace: 'imqueue',
                auth: { token: 'ghp_x' },
            },
            registry: {
                provider: 'dockerhub',
                namespace: 'imqueue',
                auth: { user: 'bob', password: 'pw' },
            },
            ci: { provider: 'github-actions' },
        },
    };
}

function stubFetch(
    handler: (url: string, init: any) => { status: number; body?: any },
) {
    return mock.method(globalThis, 'fetch', async (url: any, init: any) => {
        const { status, body } = handler(String(url), init || {});

        return {
            ok: status >= 200 && status < 300,
            status,
            json: async () => body,
        } as any;
    });
}

describe('ci providers', () => {
    afterEach(() => mock.restoreAll());

    describe('github-actions', () => {
        it('should support only github', () => {
            assert.deepEqual(githubActions.supportedVcs, ['github']);
        });

        it('should emit a test-only workflow when not dockerizing', () => {
            const files = githubActions.files(baseCtx(false));

            assert.equal(files[0].relPath, '.github/workflows/build.yml');
            assert.match(files[0].content, /npm test/);
            assert.doesNotMatch(files[0].content, /docker build/);
        });

        it('should add a docker job when dockerizing', () => {
            const files = githubActions.files(baseCtx(true));

            assert.match(files[0].content, /docker build/);
            assert.match(files[0].content, /%REGISTRY_LOGIN/);
        });

        it('should build the node matrix token', () => {
            const tokens = githubActions.tokens(baseCtx(false)) as Record<
                string,
                string
            >;

            assert.equal(tokens.GHA_NODE_MATRIX, "['lts/*', 'node']");
        });

        it('should map registry secrets into workflow env', () => {
            const tokens = githubActions.tokens(baseCtx(true)) as Record<
                string,
                string
            >;

            assert.match(
                tokens.GHA_SECRETS_ENV,
                /DOCKER_USER: \$\{\{ secrets\.DOCKER_USER \}\}/,
            );
            assert.equal(tokens.IMAGE_REF, 'imqueue/my-svc');
        });

        it('should seal and PUT secrets via the github api', async () => {
            const sodiumModule = await import('libsodium-wrappers');
            const sodium = (sodiumModule as any).default ?? sodiumModule;

            await sodium.ready;

            const kp = sodium.crypto_box_keypair();
            const pubKey = sodium.to_base64(
                kp.publicKey,
                sodium.base64_variants.ORIGINAL,
            );
            const puts: any[] = [];

            stubFetch((url, init) => {
                if (init.method === 'PUT') {
                    puts.push({ url, body: JSON.parse(init.body) });
                    return { status: 204 };
                }
                return { status: 200, body: { key: pubKey, key_id: 'kid1' } };
            });

            await githubActions.setSecrets!(baseCtx(true), [
                { name: 'DOCKER_USER', value: 'bob' },
                { name: 'DOCKER_PASS', value: 'pw' },
            ]);

            assert.equal(puts.length, 2);
            assert.match(puts[0].url, /\/actions\/secrets\/DOCKER_USER$/);
            assert.equal(puts[0].body.key_id, 'kid1');
            assert.ok(puts[0].body.encrypted_value.length > 0);
        });
    });

    describe('circleci', () => {
        it('should support github, gitlab and bitbucket', () => {
            assert.deepEqual(circleci.supportedVcs, [
                'github',
                'gitlab',
                'bitbucket',
            ]);
        });

        it('should emit a config.yml with a build_image job when dockerizing', () => {
            const files = circleci.files(baseCtx(true));

            assert.equal(files[0].relPath, '.circleci/config.yml');
            assert.match(files[0].content, /build_image/);
        });

        it('should POST env vars via the circleci api', async () => {
            const ctx = baseCtx(true);

            ctx.config.ci = { provider: 'circleci', auth: { token: 'ct' } };

            const posts: any[] = [];

            stubFetch((url, init) => {
                posts.push({ url, body: JSON.parse(init.body) });
                return { status: 201, body: {} };
            });

            await circleci.setSecrets!(ctx, [
                { name: 'DOCKER_USER', value: 'bob' },
            ]);

            assert.equal(posts.length, 1);
            assert.match(posts[0].url, /project\/gh\/imqueue\/my-svc\/envvar/);
            assert.equal(posts[0].body.name, 'DOCKER_USER');
        });

        it('should throw when no token is configured', async () => {
            const ctx = baseCtx(true);
            const prev = process.env.CIRCLE_TOKEN;

            delete process.env.CIRCLE_TOKEN;

            try {
                await assert.rejects(
                    () =>
                        circleci.setSecrets!(ctx, [{ name: 'X', value: 'y' }]),
                    /token not configured/,
                );
            } finally {
                if (prev !== undefined) {
                    process.env.CIRCLE_TOKEN = prev;
                }
            }
        });
    });
});
