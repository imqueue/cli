/*!
 * IMQ-CLI providers: registry/aws-ecr
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

/** Reads a secret value from the environment, if present. */
function fromEnv(name: string): Secret[] {
    const value = process.env[name];

    return value ? [{ name, value }] : [];
}

/**
 * Amazon Elastic Container Registry. Image path:
 * <accountId>.dkr.ecr.<region>.amazonaws.com/<name>.
 */
export const awsEcr: ContainerRegistryProvider = {
    id: 'aws-ecr',
    title: 'Amazon ECR',

    options: [
        { key: 'region', describe: 'AWS region', required: true },
        { key: 'accountId', describe: 'AWS account id', required: true },
    ],

    imageRef(ctx: CreateContext): string {
        const { region, accountId } = ctx.config.registry;

        return `${accountId}.dkr.ecr.${region}.amazonaws.com/${ctx.name}`;
    },

    secretSpecs(): SecretSpec[] {
        return [
            { name: 'AWS_ACCESS_KEY_ID', describe: 'AWS access key id' },
            {
                name: 'AWS_SECRET_ACCESS_KEY',
                describe: 'AWS secret access key',
            },
        ];
    },

    secrets(): Secret[] {
        return [
            ...fromEnv('AWS_ACCESS_KEY_ID'),
            ...fromEnv('AWS_SECRET_ACCESS_KEY'),
        ];
    },

    loginCmd(ctx: CreateContext): string {
        const { region, accountId } = ctx.config.registry;

        return (
            `aws ecr get-login-password --region ${region} | ` +
            `docker login -u AWS --password-stdin ` +
            `${accountId}.dkr.ecr.${region}.amazonaws.com`
        );
    },

    pushCmd(): string {
        return 'docker push --all-tags "$DOCKER_REPO"';
    },
};
