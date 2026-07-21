/*!
 * @imqueue/cli providers: registry/azure-acr
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
 * Azure Container Registry. Image path: <registry>.azurecr.io/<name>, where
 * the namespace is the ACR registry name.
 */
export const azureAcr: ContainerRegistryProvider = {
    id: 'azure-acr',
    title: 'Azure Container Registry',

    options: [
        {
            key: 'namespace',
            describe: 'ACR registry name (<name>.azurecr.io)',
            required: true,
        },
    ],

    imageRef(ctx: CreateContext): string {
        return `${ctx.config.registry.namespace}.azurecr.io/${ctx.name}`;
    },

    secretSpecs(): SecretSpec[] {
        return [
            { name: 'AZURE_CLIENT_ID', describe: 'Azure service principal id' },
            {
                name: 'AZURE_CLIENT_SECRET',
                describe: 'Azure service principal secret',
            },
        ];
    },

    secrets(): Secret[] {
        const id = process.env.AZURE_CLIENT_ID;
        const secret = process.env.AZURE_CLIENT_SECRET;
        const out: Secret[] = [];

        if (id) {
            out.push({ name: 'AZURE_CLIENT_ID', value: id });
        }

        if (secret) {
            out.push({ name: 'AZURE_CLIENT_SECRET', value: secret });
        }

        return out;
    },

    loginCmd(ctx: CreateContext): string {
        return (
            `docker login "${ctx.config.registry.namespace}.azurecr.io" ` +
            '-u "$AZURE_CLIENT_ID" -p "$AZURE_CLIENT_SECRET"'
        );
    },

    pushCmd(): string {
        return 'docker push --all-tags "$DOCKER_REPO"';
    },
};
