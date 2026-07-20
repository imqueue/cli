/*!
 * IMQ-CLI providers: registry/google
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
 * Google Artifact Registry (the successor to the retired Container Registry).
 * Image path: <region>-docker.pkg.dev/<project>/<repository>/<name>.
 */
export const google: ContainerRegistryProvider = {
    id: 'google',
    title: 'Google Artifact Registry',

    options: [
        { key: 'region', describe: 'Artifact Registry region', required: true },
        { key: 'project', describe: 'GCP project id', required: true },
        {
            key: 'namespace',
            describe: 'Artifact Registry repository',
            required: true,
        },
    ],

    imageRef(ctx: CreateContext): string {
        const { region, project, namespace } = ctx.config.registry;

        return `${region}-docker.pkg.dev/${project}/${namespace}/${ctx.name}`;
    },

    secretSpecs(): SecretSpec[] {
        return [
            {
                name: 'GCP_SA_KEY',
                describe: 'GCP service-account JSON key (json_key auth)',
            },
        ];
    },

    secrets(): Secret[] {
        const key = process.env.GCP_SA_KEY;

        return key ? [{ name: 'GCP_SA_KEY', value: key }] : [];
    },

    loginCmd(ctx: CreateContext): string {
        return (
            'echo "$GCP_SA_KEY" | docker login -u _json_key --password-stdin ' +
            `https://${ctx.config.registry.region}-docker.pkg.dev`
        );
    },

    pushCmd(): string {
        return 'docker push --all-tags "$DOCKER_REPO"';
    },
};
