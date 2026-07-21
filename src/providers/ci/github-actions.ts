/*!
 * IMQ-CLI providers: ci/github-actions
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
import type {
    CiProvider,
    CreateContext,
    FileFragment,
    Secret,
} from '../types.js';
import { Github } from '../../../lib/index.js';
import { registryOf, registryShellTokens } from './common.js';

const TEST_JOB = `name: Build
on:
  push:
    branches: ['**']
    tags: ['**']
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: %GHA_NODE_MATRIX
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
`;

const DOCKER_JOB = `
  docker:
    needs: test
    if: startsWith(github.ref, 'refs/tags/')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and push image
        env:
%GHA_SECRETS_ENV
        run: |
          export DOCKER_REPO="%IMAGE_REF"
          %REGISTRY_LOGIN
          docker build -t "$DOCKER_REPO:\${GITHUB_SHA}" -t "$DOCKER_REPO:latest" .
          %REGISTRY_PUSH
`;

/**
 * GitHub Actions CI. Contributes a workflow file; builds run implicitly on
 * push, and registry credentials are provisioned as encrypted repo secrets.
 */
export const githubActions: CiProvider = {
    id: 'github-actions',
    title: 'GitHub Actions',
    supportedVcs: ['github'],

    files(ctx: CreateContext): FileFragment[] {
        const content = ctx.dockerize ? TEST_JOB + DOCKER_JOB : TEST_JOB;

        return [{ relPath: '.github/workflows/build.yml', content }];
    },

    tokens(ctx: CreateContext): Record<string, string> {
        const tokens: Record<string, string> = {
            GHA_NODE_MATRIX: `[${ctx.nodeTags.map(t => `'${t}'`).join(', ')}]`,
            IMAGE_REF: '',
            REGISTRY_LOGIN: '',
            REGISTRY_PUSH: '',
            GHA_SECRETS_ENV: '',
        };

        if (!ctx.dockerize) {
            return tokens;
        }

        const registry = registryOf(ctx);

        Object.assign(tokens, registryShellTokens(ctx));
        tokens.GHA_SECRETS_ENV = (registry?.secretSpecs(ctx) || [])
            .map(s => `          ${s.name}: \${{ secrets.${s.name} }}`)
            .join('\n');

        return tokens;
    },

    async setSecrets(ctx: CreateContext, secrets: Secret[]): Promise<void> {
        if (!secrets.length) {
            return;
        }

        const { namespace, auth } = ctx.config.vcs;

        if (!namespace || !auth?.token) {
            return;
        }

        // sealed-box encryption of secret values with the repo public key
        const sodiumModule = await import('libsodium-wrappers');
        const sodium = (sodiumModule as any).default ?? sodiumModule;

        await sodium.ready;

        const gh = new Github(auth.token);
        const base = `/repos/${encodeURIComponent(namespace)}/${encodeURIComponent(ctx.name)}/actions/secrets`;
        const pk = await gh.get(`${base}/public-key`);

        for (const secret of secrets) {
            const sealed = sodium.crypto_box_seal(
                sodium.from_string(secret.value),
                sodium.from_base64(pk.key, sodium.base64_variants.ORIGINAL),
            );

            await gh.request('PUT', `${base}/${secret.name}`, {
                encrypted_value: sodium.to_base64(
                    sealed,
                    sodium.base64_variants.ORIGINAL,
                ),
                key_id: pk.key_id,
            });
        }
    },

    instructions(): string[] {
        // the pipeline reports the actual secret-provisioning outcome; keep
        // this to the always-true note so nothing over-claims
        return [
            'GitHub Actions: the workflow runs automatically on push and tags.',
        ];
    },
};
