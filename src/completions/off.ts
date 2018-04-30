/*!
 * IMQ-CLI command: completions off
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
import { Argv } from 'yargs';
import {
    existsSync as exists,
    readFileSync as read,
    writeFileSync as write
} from 'fs';
import { resolve } from '../../lib';
import chalk from 'chalk';

let PROGRAM: string = '';

// noinspection JSUnusedGlobalSymbols
export const { command, describe, builder, handler } = {
    command: 'off',
    describe: 'Disables completions for this program in your shell',

    builder(yargs: Argv) {
        PROGRAM = yargs.argv.$0;
    },

    handler() {
        const rxReplace = new RegExp(`###-begin-${PROGRAM}-completions-###` +
            '[\\s\\S]*?' + `###-end-${PROGRAM}-completions-###`);
        const isZsh = Object.keys(process.env).some(key => /^ZSH/.test(key));
        const rcFilename = isZsh ? '~/.zshrc' : '~/.bashrc';
        const rcFile = resolve(rcFilename);

        try {
            if (exists(rcFile)) {
                const rcText = read(rcFile, { encoding: 'utf8' })
                    .replace(rxReplace, '')
                    .trim();

                write(rcFile, rcText, { encoding: 'utf8' });
            }

            process.stdout.write(
                chalk.green('Completions removed from ') +
                chalk.cyan(`${rcFilename}`) + '\n' +
                'To have these changes to take effect, please, run:\n\n' +
                '  $ ' + chalk.cyan(`source ${rcFilename}`) + '\n\n'
            );
        }

        catch (err) {
            process.stderr.write(chalk.bold.red(err.message));
        }
    }
};
