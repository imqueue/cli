/*!
 * IMQ-CLI command: client generate
 *
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
 */
import { Argv, Arguments } from 'yargs';
import { IMQClient } from '@imqueue/rpc';
import * as fs from 'fs';
import * as p from 'path';
import * as inquirer from 'inquirer';
import * as chalk from 'chalk';
import { printError } from '../../lib';

// noinspection JSUnusedGlobalSymbols
export const { command, describe, builder, promptOverride, handler } = {
    command: 'generate <name> [path]',
    describe: 'Generates IMQ-RPC client for a specified service',

    builder(yargs: Argv) {
        return yargs
            .option('o', {
                alias: 'overwrite',
                describe: 'Overwrite existing client without prompt',
                boolean: true
            })
            .describe('path', 'Directory where client file should be placed')
            .default('path', '.');
    },

    async promptOverride(filePath: string) {
        const write = ((await inquirer.prompt<{ overwrite: boolean }>([{
                type: 'confirm',
                name: 'overwrite',
                default: false,
                message: `File "${filePath}" already exists. Overwrite it?`,
            }] as inquirer.QuestionCollection)) as { overwrite: boolean }
        ).overwrite;

        if (!write) {
            process.stdout.write(
                chalk.yellow('File exists, overwrite disabled, exit...'),
            );
            process.exit(0);
        }
    },

    async handler(argv: Arguments) {
        try {
            const { path, name } = argv;
            const filePath = p.resolve(path as string, `${name}.ts`);
            const exists = fs.existsSync(filePath);

            if (!argv.o && exists) {
                await promptOverride(filePath);
            }

            await IMQClient.create(name as string, {
                compile: false,
                path: path as string,
            });

            process.stdout.write(
                chalk.green('Successfully created. Path: ') +
                chalk.cyan(filePath) + '\n',
            );
        }

        catch (err) {
            printError(err);
        }
    },
};
