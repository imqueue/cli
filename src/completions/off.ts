/*!
 * IMQ-CLI command: completions off
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
import { Argv } from 'yargs';
import {
    existsSync as exists,
    readFileSync as read,
    writeFileSync as write
} from 'fs';
import { resolve, printError, IS_ZSH } from '../../lib';
import chalk from 'chalk';

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

    builder(yargs: Argv) {
        PROGRAM = yargs.argv.$0;
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
