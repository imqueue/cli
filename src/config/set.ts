/*!
 * IMQ-CLI command: config set
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
import { Arguments } from 'yargs';
import * as chalk from 'chalk';
import {
    printError,
    loadConfig,
    saveConfig,
    prepareConfigValue
} from '../../lib';

// noinspection JSUnusedGlobalSymbols
export const { command, describe, handler } = {
    command: 'set <option> <value>',
    describe: 'Updates given config option with given value',

    handler(argv: Arguments) {
        try {
            const config = loadConfig();

            config[(argv as any).option] = prepareConfigValue(
                (argv as any).value
            );
            saveConfig(config);

            process.stdout.write(
                chalk.green('Option ') +
                chalk.cyan(`${(argv as any).option}`) +
                chalk.green(' is set to ') +
                chalk.cyan(`${(argv as any).value}`) + '\n'
            );
        }

        catch (err) {
            printError(err);
        }
    }
};
