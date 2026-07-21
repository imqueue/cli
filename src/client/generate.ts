/*!
 * IMQ-CLI command: client generate
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
import { type Argv, type Arguments } from 'yargs';
import { IMQClient } from '@imqueue/rpc';
import * as fs from 'fs';
import * as p from 'path';
import inquirer, { type QuestionCollection } from 'inquirer';
import { printError } from '../../lib/index.js';

export const { command, describe, builder, promptOverride, handler } = {
    command: 'generate <name> [path]',
    describe: 'Generates IMQ-RPC client for a specified service',

    builder(yargs: Argv) {
        return yargs
            .option('o', {
                alias: 'overwrite',
                describe: 'Overwrite existing client without prompt',
                boolean: true,
            })
            .option('w', {
                alias: 'timeout',
                describe:
                    'Seconds to wait for the service to respond before ' +
                    'giving up (0 = wait forever)',
                number: true,
                default: 30,
            })
            .describe('path', 'Directory where client file should be placed')
            .default('path', '.');
    },

    async promptOverride(filePath: string) {
        const write = (
            (await inquirer.prompt<{ overwrite: boolean }>([
                {
                    type: 'confirm',
                    name: 'overwrite',
                    default: false,
                    message: `File "${filePath}" already exists. Overwrite it?`,
                },
            ] as QuestionCollection)) as { overwrite: boolean }
        ).overwrite;

        if (!write) {
            process.stdout.write(
                styleText('yellow', 'File exists, overwrite disabled, exit...'),
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

            // IMQClient.create connects to the broker and waits for the target
            // service to answer; if the service isn't running it would hang
            // forever. Race it against a timeout so CI/interactive runs fail
            // with an actionable message instead of blocking.
            const seconds = Number(argv.timeout ?? argv.w ?? 30);
            const create = IMQClient.create(name as string, {
                compile: false,
                path: path as string,
            });

            if (seconds > 0) {
                let timer: ReturnType<typeof setTimeout>;
                const timeout = new Promise<never>((_, reject) => {
                    timer = setTimeout(() => {
                        reject(
                            new Error(
                                `Service "${name}" did not respond within ` +
                                    `${seconds}s. Is it running? ` +
                                    "(check 'imq ctl status'), or raise " +
                                    '--timeout / use --timeout 0 to wait.',
                            ),
                        );
                    }, seconds * 1000);
                    timer.unref?.();
                });

                await Promise.race([create, timeout]).finally(() =>
                    clearTimeout(timer),
                );
            } else {
                await create;
            }

            process.stdout.write(
                styleText('green', 'Successfully created. Path: ') +
                    styleText('cyan', filePath) +
                    '\n',
            );
        } catch (err) {
            printError(err as Error);
            // the broker connection may keep the event loop alive; exit so a
            // timeout/failure doesn't leave the process hanging
            process.exit(1);
        }
    },
};
