/*!
 * IMQ-CLI command: config set
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
