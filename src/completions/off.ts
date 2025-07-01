/*!
 * IMQ-CLI command: completions off
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
import { Argv } from 'yargs';
import {
    existsSync as exists,
    readFileSync as read,
    writeFileSync as write
} from 'fs';
import { resolve, printError, IS_ZSH } from '../../lib';
import * as chalk from 'chalk';

let PROGRAM: string = '';
let RX_REPLACE: RegExp;

// istanbul ignore next
/**
 * Prints script removal success message to the user
 *
 * @access private
 * @param {string} rcFilename - path to shell rc file modified
 */
function printSuccess(rcFilename: string) {
    process.stdout.write(
        chalk.green('Completions removed from ') +
        chalk.cyan(`${rcFilename}`) + '\n' +
        'To have these changes to take effect, please, run:\n\n' +
        '  $ ' + chalk.cyan(`source ${rcFilename}`) + '\n\n'
    );
}

// noinspection JSUnusedGlobalSymbols
export const { command, describe, builder, handler } = {
    command: 'off',
    describe: 'Disables completions for this program in your shell',

    async builder(yargs: Argv) {
        PROGRAM = (await yargs.argv).$0;
        RX_REPLACE = new RegExp(`###-begin-${PROGRAM}-completions-###`
            + '[\\s\\S]*?' + `###-end-${PROGRAM}-completions-###`);
    },

    handler() {
        try {
            const rcFilename = IS_ZSH ? '~/.zshrc' : '~/.bashrc';
            const rcFile = resolve(rcFilename);

            if (exists(rcFile)) {
                const rcText = read(rcFile, { encoding: 'utf8' })
                    .replace(RX_REPLACE, '')
                    .trim() + '\n';

                write(rcFile, rcText, { encoding: 'utf8' });
            }

            printSuccess(rcFilename);
        }

        catch (err) {
            printError(err);
        }
    }
};
