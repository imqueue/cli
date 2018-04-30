/*!
 * IMQ-CLI library: error
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
import chalk from 'chalk';

// that is just a printing function, no need to do specific tests
// istanbul ignore next
/**
 * Prints error message to standard error output
 *
 * @param {Error} err - error to display message from
 * @param {boolean} [withStackTrace] - if true will printError error stack
 */
export function printError(err: Error, withStackTrace: boolean = false) {
    process.stderr.write(chalk.bold.red(err.message) + '\n');

    if (withStackTrace && err.stack) {
        process.stderr.write(chalk.cyan(err.stack) + '\n');
    }
}
