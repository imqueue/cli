/*!
 * IMQ-CLI command: config get
 *
 * Copyright (c) 2018, imqueue.com <support@imqueue.com>
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
import * as chalk from 'chalk';
import { printError, loadConfig } from '../../lib';

let PROGRAM: string = '';

// noinspection JSUnusedGlobalSymbols
export const { command, describe, builder, handler } = {
    command: 'get [option]',
    describe: 'Prints value for given option from config. If option is ' +
              'not provided, will list all config options',

    async builder(yargs: Argv) {
        PROGRAM = (await yargs.argv).$0;

        return yargs
            .option('j', {
                alias: 'json',
                boolean: true,
                default: false,
                describe: 'Prints config in JSON format (only if ' +
                          'option is not passed)'
            })
            .default('option', '')
            .describe('option', 'Config option to display value [optional]');
    },

    handler(argv: Arguments) {
        try {
            const config = loadConfig();
            const options = config && Object.keys(config) || [];

            if (!options.length) {
                return process.stdout.write(
                    chalk.bold.yellow(
                        'Config is empty. Try to init if first by running:') +
                    '\n\n  $ ' +
                    chalk.cyan(`${PROGRAM} config init`) + '\n\n'
                );
            }

            if ((argv as any).option) {
                return process.stdout.write(
                    JSON.stringify(config[(argv as any).option]) + '\n'
                );
            }

            process.stdout.write(chalk.bold.green('IMQ CLI Config:') + '\n');

            if ((argv as any).json) {
                return process.stdout.write(
                    chalk.cyan(JSON.stringify(config, null, 2)) + '\n'
                );
            }

            for (let option of options) {
                process.stdout.write(
                    chalk.yellow(`${option}`) + ' = ' +
                    chalk.cyan(JSON.stringify(config[option])) + '\n'
                );
            }
        }

        catch (err) {
            printError(err);
        }
    }
};
