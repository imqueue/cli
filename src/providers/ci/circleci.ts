/*!
 * @imqueue/cli providers: ci/circleci
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
import { registryShellTokens } from './common.js';

// overridable for CircleCI server / integration testing
const API = process.env.IMQ_CIRCLECI_API_URL || 'https://circleci.com/api/v2';

const VCS_SLUG: Record<string, string> = {
    github: 'gh',
    gitlab: 'gl',
    bitbucket: 'bb',
};

const TEST_CONFIG = `version: 2.1
jobs:
  test:
    docker:
      - image: cimg/node:lts
    steps:
      - checkout
      - run: npm ci
      - run: npm test
`;

const DOCKER_CONFIG = `  build_image:
    machine: true
    steps:
      - checkout
      - run: |
          export DOCKER_REPO="%IMAGE_REF"
          %REGISTRY_LOGIN
          docker build -t "$DOCKER_REPO:$CIRCLE_SHA1" -t "$DOCKER_REPO:latest" .
          %REGISTRY_PUSH
`;

const WORKFLOW_TEST = `workflows:
  build:
    jobs:
      - test
`;

const WORKFLOW_DOCKER = `workflows:
  build:
    jobs:
      - test
      - build_image:
          requires: [test]
          filters:
            tags:
              only: /^v.*/
            branches:
              ignore: /.*/
`;

/**
 * Resolves the CircleCI api token from config or the environment.
 *
 * @param {CreateContext} ctx
 * @return {string | undefined}
 */
function circleToken(ctx: CreateContext): string | undefined {
    return ctx.config.ci.auth?.token || process.env.CIRCLE_TOKEN || undefined;
}

/**
 * CircleCI. Works with github, gitlab and bitbucket. Contributes a
 * .circleci/config.yml; registry credentials are provisioned as project
 * environment variables via the CircleCI API when a token is available.
 */
export const circleci: CiProvider = {
    id: 'circleci',
    title: 'CircleCI',
    supportedVcs: ['github', 'gitlab', 'bitbucket'],

    files(ctx: CreateContext): FileFragment[] {
        const content = ctx.dockerize
            ? TEST_CONFIG + DOCKER_CONFIG + WORKFLOW_DOCKER
            : TEST_CONFIG + WORKFLOW_TEST;

        return [{ relPath: '.circleci/config.yml', content }];
    },

    tokens(ctx: CreateContext): Record<string, string> {
        return registryShellTokens(ctx);
    },

    async setSecrets(ctx: CreateContext, secrets: Secret[]): Promise<void> {
        if (!secrets.length) {
            return;
        }

        const token = circleToken(ctx);

        if (!token) {
            throw new Error('CircleCI token not configured');
        }

        const slug = `${VCS_SLUG[ctx.config.vcs.provider || 'github'] || 'gh'}/${ctx.config.vcs.namespace}/${ctx.name}`;

        for (const secret of secrets) {
            const res = await fetch(`${API}/project/${slug}/envvar`, {
                method: 'POST',
                headers: {
                    'circle-token': token,
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    name: secret.name,
                    value: secret.value,
                }),
            });

            if (!res.ok) {
                throw new Error(
                    `CircleCI envvar ${secret.name} failed: HTTP ${res.status}`,
                );
            }
        }
    },

    instructions(): string[] {
        return [
            'CircleCI: connect the repository at https://app.circleci.com/ to ' +
                'start builds. Set CIRCLE_TOKEN (or ci.auth.token) to let imq ' +
                'provision registry credentials automatically.',
        ];
    },
};
