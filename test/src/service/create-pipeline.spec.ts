/*!
 * @imqueue/cli Unit Tests: service create pipeline - CI/docker token application
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
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import '../../mocks/index.js';
import { registerBuiltinProviders } from '../../../src/providers/index.js';
import { applyCi } from '../../../src/service/create-pipeline.js';

registerBuiltinProviders();

// a dockerized plan for a given CI provider; nodeDockerTag is set explicitly so
// the base-image tag resolves without a network call to nodeVersion()
function dockerizedPlan(ci: string, path: string): any {
    return {
        name: 'identity',
        className: 'Identity',
        version: '1.0.0-0',
        description: 'identity - @imqueue based service',
        author: 'Jane',
        email: 'jane@dev.io',
        nodeTags: ['lts/*', 'node'],
        nodeDockerTag: '22',
        dockerize: true,
        useVcs: false,
        path,
        template: 'default',
        homepage: '',
        bugs: '',
        noInstall: true,
        license: {
            name: 'UNLICENSED',
            tag: 'UNLICENSED',
            header: '',
            text: '',
        },
        config: {
            vcs: {
                provider: 'github',
                namespace: 'imqueuesandbox',
                auth: { token: 'ghp_x' },
            },
            registry: {
                provider: 'dockerhub',
                namespace: 'imqueuesandbox',
                auth: { user: 'bob', password: 'pw' },
            },
            ci: { provider: ci },
            packages: [],
        },
    };
}

describe('service create pipeline: applyCi() docker base image', () => {
    // regression: only the travis provider used to set %NODE_DOCKER_TAG, so a
    // dockerized github-actions / circleci service shipped a Dockerfile with the
    // literal `FROM node:%NODE_DOCKER_TAG-alpine`, which `docker build` rejects.
    for (const ci of ['github-actions', 'circleci']) {
        it(`substitutes %NODE_DOCKER_TAG for a dockerized ${ci} service`, async () => {
            const dir = mkdtempSync(join(tmpdir(), 'imq-pipe-'));

            try {
                writeFileSync(
                    join(dir, 'Dockerfile'),
                    'FROM node:%NODE_DOCKER_TAG-alpine AS base\n',
                );

                await applyCi(dockerizedPlan(ci, dir), false, true);

                const dockerfile = readFileSync(
                    join(dir, 'Dockerfile'),
                    'utf8',
                );

                assert.match(dockerfile, /FROM node:22-alpine AS base/);
                assert.doesNotMatch(dockerfile, /%NODE_DOCKER_TAG/);
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        });
    }
});
