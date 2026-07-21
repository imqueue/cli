/*!
 * @imqueue/cli command: config get
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
import { printError, loadConfig, getPath } from '../../lib/index.js';

export const { command, describe, builder, handler } = {
    command: 'get [option]',
    describe:
        'Prints value for given option from config. If option is ' +
        'not provided, will list all config options',

    builder(yargs: Argv) {
        // NOTE: do not read `yargs.argv` here - under strict mode that early
        // parse rejects the positional as an unknown argument. The program
        // name is taken from argv.$0 in the handler instead.
        return yargs
            .option('j', {
                alias: 'json',
                boolean: true,
                default: false,
                describe:
                    'Prints config in JSON format (only if ' +
                    'option is not passed)',
            })
            .default('option', '')
            .describe('option', 'Config option to display value [optional]');
    },

    handler(argv: Arguments) {
        try {
            const program = (argv.$0 as string) || 'imq';
            const config = loadConfig();
            const options = (config && Object.keys(config)) || [];
            const option = (argv as any).option as string;

            // a single option was requested: emit ONLY its JSON value on stdout
            // (scripting-friendly). An unset option is a stderr error + exit 1,
            // never the literal string "undefined" on stdout at exit 0.
            if (option) {
                const value = getPath(config, option);

                if (value === undefined) {
                    process.stderr.write(
                        styleText('yellow', `Option "${option}" is not set.`) +
                            '\n',
                    );
                    process.exitCode = 1;

                    return;
                }

                return process.stdout.write(JSON.stringify(value) + '\n');
            }

            // whole-config JSON dump: pure JSON on stdout, no header, so
            // `imq config get --json | jq` works ({} for an empty config)
            if ((argv as any).json) {
                return process.stdout.write(
                    JSON.stringify(config, null, 2) + '\n',
                );
            }

            // human-readable listing
            if (!options.length) {
                return process.stdout.write(
                    styleText(
                        ['bold', 'yellow'],
                        'Config is empty. Try to initialize it first by ' +
                            'running:',
                    ) +
                        '\n\n  $ ' +
                        styleText('cyan', `${program} config init`) +
                        '\n\n',
                );
            }

            process.stdout.write(
                styleText(['bold', 'green'], '@imqueue CLI Config:') + '\n',
            );

            for (let option of options) {
                process.stdout.write(
                    styleText('yellow', `${option}`) +
                        ' = ' +
                        styleText('cyan', JSON.stringify(config[option])) +
                        '\n',
                );
            }
        } catch (err) {
            printError(err as Error);
        }
    },
};
