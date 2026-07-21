/*!
 * @imqueue/cli providers: registry/dockerhub
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
    ContainerRegistryProvider,
    CreateContext,
    Secret,
    SecretSpec,
} from '../types.js';

/**
 * DockerHub container registry. Image references are "namespace/name"; login
 * uses a username/password pair provisioned as CI secrets.
 */
export const dockerhub: ContainerRegistryProvider = {
    id: 'dockerhub',
    title: 'Docker Hub',

    options: [
        { key: 'namespace', describe: 'Docker Hub namespace', required: true },
    ],

    imageRef(ctx: CreateContext): string {
        const ns = ctx.config.registry.namespace || '';

        return ns ? `${ns}/${ctx.name}` : ctx.name;
    },

    secretSpecs(): SecretSpec[] {
        return [
            { name: 'DOCKER_USER', describe: 'Docker Hub username' },
            { name: 'DOCKER_PASS', describe: 'Docker Hub password or token' },
        ];
    },

    secrets(ctx: CreateContext): Secret[] {
        const auth = ctx.config.registry.auth || {};

        // omit empty credentials: provisioning empty secrets to CI only causes
        // an opaque `docker login` failure later; the "add them manually"
        // instruction path fires instead
        return [
            { name: 'DOCKER_USER', value: auth.user || '' },
            { name: 'DOCKER_PASS', value: auth.password || '' },
        ].filter(s => s.value);
    },

    loginCmd(): string {
        return 'docker login -u "$DOCKER_USER" -p "$DOCKER_PASS"';
    },

    pushCmd(): string {
        return 'docker push --all-tags "$DOCKER_REPO"';
    },
};
