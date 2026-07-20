/*!
 * IMQ-CLI providers: ci/travis
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
import { styleText } from 'node:util';
import type { CiProvider, CreateContext, FileFragment } from '../types.js';
import { containerRegistries } from '../registry.js';
import {
    enableBuilds,
    nodeVersion,
    travisEncrypt,
} from '../../../lib/index.js';

/**
 * Encrypts the registry secrets into travis "secure" entries. Never fatal:
 * if the (legacy) travis encryption endpoint is unreachable, returns an empty
 * value and warns, matching the pre-provider behavior.
 *
 * @param {CreateContext} ctx
 * @return {Promise<string>}
 */
async function dockerSecrets(ctx: CreateContext): Promise<string> {
    const registryId = ctx.config.registry.provider;

    if (!registryId || !containerRegistries.has(registryId)) {
        return '';
    }

    const registry = containerRegistries.get(registryId);
    const repo = `${ctx.config.vcs.namespace}/${ctx.name}`;
    const token = ctx.config.vcs.auth?.token;
    const usePro = !!ctx.config.vcs.private;

    try {
        const encrypted: string[] = [];

        for (const secret of registry.secrets(ctx)) {
            encrypted.push(
                await travisEncrypt(
                    repo,
                    `${secret.name}="${secret.value}"`,
                    usePro ? token : undefined,
                ),
            );
        }

        return encrypted.length
            ? `- secure: ${encrypted.join('\n  - secure: ')}`
            : '';
    } catch {
        console.log(
            styleText(
                'red',
                'Could not encrypt CI secrets (CI service unavailable). ' +
                    'Skipping - configure CI secrets manually if needed.',
            ),
        );

        return '';
    }
}

/**
 * Travis CI (legacy). Kept fully working for backward compatibility, but not
 * promoted as a default. The v1 template ships its own .travis.yml, so this
 * provider contributes no files - only tokens and build activation.
 */
export const travis: CiProvider = {
    id: 'travis',
    title: 'Travis CI (legacy)',
    supportedVcs: ['github'],

    files(ctx: CreateContext): FileFragment[] {
        const head = `dist: xenial
language: node_js
node_js:
%TRAVIS_NODE_TAG
`;

        if (!ctx.dockerize) {
            return [{ relPath: '.travis.yml', content: head }];
        }

        // docker build & push wired to the selected registry's credentials
        return [
            {
                relPath: '.travis.yml',
                content: `${head}services:
- docker
after_success:
- export DOCKER_REPO="%DOCKER_NAMESPACE/%SERVICE_NAME"
- export VERSION_REGEX="^v([0-9]+)\\.([0-9]+)\\.([0-9]+)$"
- export DEV_VERSION_REGEX="^v([0-9]+)\\.([0-9]+)\\.([0-9]+)-([0-9A-Za-z]+)$"
- export DOCKER_TAGS=()
- export DATE_STR=\`date +"%Y-%m-%d-%H-%M-%S"\`
- docker build -f Dockerfile -t $DOCKER_REPO:$TRAVIS_COMMIT . || travis_terminate 1
- if [[ $TRAVIS_TAG =~ $DEV_VERSION_REGEX ]]; then
    DOCKER_TAGS+=( "dev" ) && DOCKER_TAGS+=( $TRAVIS_TAG );
  fi
- if [[ $TRAVIS_TAG =~ $VERSION_REGEX ]]; then
    DOCKER_TAGS+=( "latest" ) && DOCKER_TAGS+=( $TRAVIS_TAG );
  fi
- if [[ $TRAVIS_BRANCH == "release" ]]; then
    DOCKER_TAGS+=( "release" ) && DOCKER_TAGS+=( "release-\${DATE_STR}");
  fi
- if [ \${#DOCKER_TAGS[@]} -gt 0 ] && [ "$TRAVIS_PULL_REQUEST" == "false" ]; then
    for tag in "\${DOCKER_TAGS[@]}"; do
      docker tag $DOCKER_REPO:$TRAVIS_COMMIT $DOCKER_REPO:$tag;
    done;
    docker login -u $DOCKER_USER -p $DOCKER_PASS || travis_terminate 1;
    docker push $DOCKER_REPO || travis_terminate 1;
  fi
env:
  global:
  %DOCKER_SECRETS
`,
            },
        ];
    },

    async tokens(ctx: CreateContext): Promise<Record<string, string>> {
        // always define every token so placeholders never leak as literal text
        const tokens: Record<string, string> = {
            TRAVIS_NODE_TAG: ctx.nodeTags.map(t => `- ${t}`).join('\n'),
            DOCKER_NAMESPACE: '',
            NODE_DOCKER_TAG: '',
            DOCKER_SECRETS: '',
        };

        if (!ctx.dockerize) {
            return tokens;
        }

        console.log('Building docker <-> CI integration...');

        const nodeDockerTag =
            ctx.nodeDockerTag || (await nodeVersion(ctx.nodeTags[0]));

        if (!nodeDockerTag) {
            throw new TypeError('Invalid node version specified!');
        }

        console.log('Encrypting secrets...');

        tokens.DOCKER_NAMESPACE = ctx.config.registry.namespace || '';
        tokens.NODE_DOCKER_TAG = nodeDockerTag;
        tokens.DOCKER_SECRETS = await dockerSecrets(ctx);

        return tokens;
    },

    async enable(ctx: CreateContext): Promise<void> {
        console.log('Enabling travis builds...');

        const enabled = await enableBuilds(
            ctx.config.vcs.namespace || '',
            ctx.name,
            ctx.config.vcs.auth?.token || '',
            !!ctx.config.vcs.private,
        );

        if (!enabled) {
            throw new Error('travis build activation did not succeed');
        }
    },

    instructions(ctx: CreateContext): string[] {
        return ctx.dockerize
            ? [
                  'Travis is a legacy CI. If build activation failed, enable ' +
                      'it manually at https://www.travis-ci.com/ and add your ' +
                      'DOCKER_USER / DOCKER_PASS secrets.',
              ]
            : [];
    },
};
