/*!
 * IMQ-CLI command: client generate
 *
 * Copyright (c) 2018, Mykhailo Stadnyk <mikhus@gmail.com>
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 * OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */
import { Argv, Arguments } from 'yargs';
import { IMQClient } from 'imq-rpc';
import * as fs from 'fs';
import * as p from 'path';
import * as inquirer from 'inquirer';
import chalk from 'chalk';

// noinspection JSUnusedGlobalSymbols
export const { command, describe, builder, handler } = {
    command: 'generate <name> [path]',
    describe: 'Generates IMQ-RPC client for a specified service',

    builder(yargs: Argv) {
        return yargs
            .option('o', {
                alias: 'overwrite',
                describe: 'Overwrite existing client without prompt',
                boolean: true
            })
            .default('path', '.');
    },

    async handler(argv: Arguments) {
        const { path, name } = argv;
        const filePath = p.resolve(path, `${name}.ts`);
        const exists = fs.existsSync(filePath);

        if (!argv.o && exists) {
			const write = (await inquirer.prompt<{overwrite: boolean}>([{
                type: 'confirm',
                name: 'overwrite',
                default: false,
                message: `File "${filePath}" already exists. Overwrite it?`
			}])).overwrite;

			if (!write) {
			    process.stdout.write(
			        chalk.yellow('File exists, overwrite disabled, exit...')
                );
                process.exit(0);
            }
        }

        try {
            await IMQClient.create(name, {
                compile: false,
                path
            });

            process.stdout.write(
                chalk.green('Successfully created. Path: ') +
                chalk.cyan(filePath) + '\n'
            );
        }

        catch(err) {
            process.stderr.write(chalk.bold.red(err.message) + '\n');
        }
    }
};
