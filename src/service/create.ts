/*!
 * @imqueue/cli command: service create
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
        // NOTE: config values are intentionally NOT injected as yargs defaults.
        // Doing so would make a global-config value look like a passed flag and
        // out-rank a per-service .imqrc.json. Resolution (flag -> .imqrc.json ->
        // global -> prompt -> default) is handled in buildCreatePlan instead.
        return (
            yargs
                .alias('a', 'author')
                .describe(
                    'a',
                    'Service author full name (person or organization)',
                )
                .string('a')

                .alias('e', 'email')
                .describe('e', "Service author's contact email")
                .string('e')

                .alias('g', 'use-git')
                .describe('g', 'Turns on automatic git repo creation')
                .boolean('g')

                .describe('vcs', 'VCS host (github, gitlab, bitbucket)')
                .string('vcs')

                .alias('u', ['github-namespace', 'vcs-namespace'])
                .describe(
                    'u',
                    'VCS namespace (user, organization or workspace)',
                )
                .string('u')

                // declared as the positive `install` (default true) so that, under
                // yargs strict mode, the negated `--no-install` is a known flag
                .describe(
                    'install',
                    'Install npm packages after creation (use --no-install to skip)',
                )
                .boolean('install')
                .default('install', true)

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
                .string('l')

                .alias('t', 'template')
                .describe(
                    't',
                    'Template used to create service (should be either template ' +
                        'name, git url or file system directory)',
                )
                .string('t')

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

                .describe(
                    'registry',
                    'Container registry (dockerhub, google, aws-ecr, azure-acr)',
                )
                .string('registry')

                .alias('N', 'docker-namespace')
                .describe('N', 'Registry namespace / repository / ACR name')
                .string('N')

                .describe('region', 'Registry region (google, aws-ecr)')
                .string('region')
                .describe('project', 'GCP project id (google)')
                .string('project')
                .describe('account-id', 'AWS account id (aws-ecr)')
                .string('account-id')

                .alias('T', ['github-token', 'vcs-token'])
                .describe('T', 'VCS auth token')
                .string('T')

                .alias('p', 'private')
                .describe('p', 'Create the service repository as private')
                .boolean('p')

                .describe(
                    'ci',
                    'CI provider (github-actions, circleci, travis)',
                )
                .string('ci')

                .describe(
                    'packages',
                    'Comma-separated @imqueue addon packages to include ' +
                        '(use --no-packages for none; run `imq service ' +
                        'packages` to list them)',
                )

                .describe('dry-run', 'Print the resolved plan and exit')
                .boolean('dry-run')
                .default('dry-run', false)

                .alias('y', 'yes')
                .describe('y', 'Skip the confirmation prompt')
                .boolean('y')
                .default('y', false)

                .alias('f', 'force')
                .describe(
                    'f',
                    'Scaffold into a non-empty target directory, overwriting ' +
                        'existing files',
                )
                .boolean('f')
                .default('f', false)

                .default('name', path.basename(process.cwd()))
                .describe('name', 'Service name to create with')

                .default('path', '.')
                .describe(
                    'path',
                    'Path to directory where service will be generated to',
                )

                // group options so the (large) --help is scannable
                .group(['a', 'e', 'd', 'V', 'l'], 'Identity:')
                .group(['g', 'vcs', 'u', 'T', 'p'], 'VCS (repository):')
                .group(['ci'], 'CI:')
                .group(
                    [
                        'D',
                        'registry',
                        'N',
                        'region',
                        'project',
                        'account-id',
                        'L',
                    ],
                    'Container registry:',
                )
                .group(['t', 'packages', 'n'], 'Template & packages:')
                .group(
                    ['install', 'dry-run', 'y', 'f', 'name', 'path'],
                    'Behavior:',
                )

                .example(
                    '$0 service create billing ./billing -a "Me" ' +
                        '-e me@x.io --no-use-git',
                    'Local-only service (no repository or CI)',
                )
                .example(
                    '$0 service create billing -a "Me" -e me@x.io ' +
                        '--vcs github -u my-org -T $TOKEN',
                    'Create and push a GitHub repository',
                )
                .example(
                    '$0 service create billing ./billing --dry-run',
                    'Preview the resolved plan, make no changes',
                )
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

        // never scaffold into a populated directory without an explicit
        // opt-in: the default path is '.', so a mistyped command would
        // otherwise overwrite files in the current project (package.json,
        // README, …) and report success
        if (!argv.force) {
            let existing: string[] = [];

            try {
                existing = fs.readdirSync(plan.path);
            } catch {
                /* missing / unreadable -> treated as empty, nothing to guard */
            }

            if (existing.length) {
                const shown = existing.slice(0, 5).join(', ');
                const more = existing.length > 5 ? ', …' : '';

                printError(
                    new Error(
                        `Target directory ${plan.path} is not empty ` +
                            `(found ${shown}${more}). Refusing to overwrite ` +
                            'existing files - pass --force to scaffold into ' +
                            'it anyway, or choose an empty --path.',
                    ),
                );

                return;
            }
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
