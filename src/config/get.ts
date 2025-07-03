/*!
 * IMQ-CLI command: config get
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
import { Argv, Arguments } from 'yargs';
import chalk from 'chalk';
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
