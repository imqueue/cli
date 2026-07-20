/*!
 * IMQ-CLI command: service create
 *
 * I'm Queue Software Project
 * Copyright (C) 2025  imqueue.com <support@imqueue.com>
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
import * as path from 'path';
import * as fs from 'fs';
import { type Argv } from 'yargs';
import inquirer, { type QuestionCollection } from 'inquirer';
import {
    type IMQCLIConfig,
    loadConfig,
    loadServiceConfig,
    printError,
    resolve,
    rmdir,
    OS_HOME,
} from '../../lib/index.js';
import { vcsHosts, registerBuiltinProviders } from '../providers/index.js';
import {
    DEFAULT_SERVICE_VERSION,
    type CreatePlan,
    buildCreatePlan,
} from './create-plan.js';
import {
    type CreateState,
    printPlanSummary,
    runCreate,
} from './create-pipeline.js';

let config: IMQCLIConfig;

/**
 * Attempts to roll back a repository this run created, prompting first when
 * interactive. Never throws.
 *
 * @param {CreatePlan} plan
 */
async function rollbackRepository(plan: CreatePlan): Promise<void> {
    const vcs = vcsHosts.tryGet(plan.config.vcs.provider as string);

    if (!vcs?.deleteRepository) {
        return;
    }

    let doDelete = !plan.interactive ? false : true;

    if (plan.interactive) {
        const answer = await inquirer.prompt<{ del: boolean }>([
            {
                type: 'confirm',
                name: 'del',
                message:
                    `A ${vcs.title} repository was already created. Delete ` +
                    'it to roll back?',
                default: true,
            },
        ] as QuestionCollection);

        doDelete = answer.del;
    }

    if (!doDelete) {
        console.log(
            styleText(
                'yellow',
                `Leaving the created ${vcs.title} repository in place.`,
            ),
        );

        return;
    }

    try {
        await vcs.deleteRepository(plan);
        console.log(styleText('green', 'Rolled back the created repository.'));
    } catch {
        console.log(
            styleText(
                'red',
                'Could not delete the created repository; remove it manually.',
            ),
        );
    }
}

export const { command, describe, builder, handler } = {
    command: 'create [name] [path]',
    describe:
        'Creates new service package with the given service name ' +
        'under given path.',

    builder(yargs: Argv) {
        config = loadConfig();

        return yargs
            .alias('a', 'author')
            .describe('a', 'Service author full name (person or organization)')
            .default('a', config.author || '')

            .alias('e', 'email')
            .describe('e', "Service author's contact email")
            .default('e', config.email || '')

            .alias('g', 'use-git')
            .describe('g', 'Turns on automatic git repo creation')
            .boolean('g')

            .alias('u', 'github-namespace')
            .describe(
                'u',
                'GitHub namespace (usually user name or organization name)',
            )
            .default('u', (config.gitBaseUrl || '').split(':').pop() || '')

            .describe(
                'no-install',
                'Do not install npm packages automatically on service creation',
            )
            .boolean('no-install')
            .default('no-install', false)

            .alias('V', 'service-version')
            .describe('V', 'Initial service version')
            .default('V', DEFAULT_SERVICE_VERSION)

            .alias('H', 'homepage')
            .describe('H', 'Homepage URL for service, if required')
            .default('H', '')

            .alias('B', 'bugs-url')
            .describe('B', 'Bugs url for service, if required')
            .default('B', '')

            .alias('l', 'license')
            .describe(
                'l',
                'License for created service, should be either license name ' +
                    'in SPDX format or path to a custom license file',
            )
            .default('l', config.license || 'UNLICENSED')

            .alias('t', 'template')
            .describe(
                't',
                'Template used to create service (should be either template ' +
                    'name, git url or file system directory)',
            )
            .default('t', config.template || 'default')

            .alias('d', 'description')
            .describe('d', 'Service description')
            .default('d', '')

            .alias('n', 'node-versions')
            .describe(
                'n',
                'Node version tags to use for builds, separated by comma if ' +
                    'multiple. First one will be used for docker build, if ' +
                    'dockerize option enabled.',
            )
            .default('n', '')

            .alias('D', 'dockerize')
            .describe('D', 'Enable service dockerization with CI builds')
            .boolean('D')

            .alias('L', 'node-docker-tag')
            .describe(
                'L',
                'Node docker tag to use as base docker image for docker builds',
            )
            .default('L', '')

            .alias('N', 'docker-namespace')
            .describe('N', 'Docker hub namespace')
            .default('N', config.dockerHubNamespace)

            .alias('T', 'github-token')
            .describe('T', 'GitHub auth token')
            .default('T', config.gitHubAuthToken)

            .alias('p', 'private')
            .describe('p', 'Service repository will be private at GitHub')
            .boolean('p')

            .describe('dry-run', 'Print the resolved plan and exit')
            .boolean('dry-run')
            .default('dry-run', false)

            .alias('y', 'yes')
            .describe('y', 'Skip the confirmation prompt')
            .boolean('y')
            .default('y', false)

            .default('name', path.basename(process.cwd()))
            .describe('name', 'Service name to create with')

            .default('path', '.')
            .describe(
                'path',
                'Path to directory where service will be generated to',
            );
    },

    async handler(argv: any) {
        registerBuiltinProviders();

        const interactive = !!(process.stdin.isTTY && process.stdout.isTTY);
        let plan: CreatePlan;

        try {
            plan = await buildCreatePlan(argv, {
                global: loadConfig(),
                service: loadServiceConfig(resolve(argv.path)),
                interactive,
                dryRun: !!argv.dryRun,
            });
        } catch (err) {
            printError(err as Error);
            return;
        }

        printPlanSummary(plan);

        if (argv.dryRun) {
            console.log(styleText('cyan', 'Dry run - no changes made.'));
            return;
        }

        // confirm only when interactive and not explicitly skipped
        if (interactive && !argv.yes) {
            const answer = await inquirer.prompt<{ proceed: boolean }>([
                {
                    type: 'confirm',
                    name: 'proceed',
                    message: 'Proceed with service creation?',
                    default: true,
                },
            ] as QuestionCollection);

            if (!answer.proceed) {
                console.log(styleText('yellow', 'Aborted.'));
                return;
            }
        }

        // remember whether the target existed before this run so a failure
        // never deletes a directory we did not create
        const preExisted = fs.existsSync(plan.path);
        const state: CreateState = { repoCreated: false };

        try {
            await runCreate(plan, state);
            console.log(styleText('green', 'Service successfully created!'));
        } catch (err) {
            if (
                !preExisted &&
                plan.path !== resolve('.') &&
                plan.path !== OS_HOME
            ) {
                rmdir(plan.path);
            }

            if (state.repoCreated) {
                await rollbackRepository(plan);
            }

            printError(err as Error);
        }
    },
};
