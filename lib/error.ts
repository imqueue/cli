/*!
 * IMQ-CLI library: error
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
import * as chalk from 'chalk';

// that is just a printing function, no need to do specific tests
// istanbul ignore next
/**
 * Prints error message to standard error output
 *
 * @param {Error} err - error to display message from
 * @param {boolean} [withStackTrace] - if true will printError error stack
 */
export function printError(err: Error, withStackTrace: boolean = false) {
    let message: string = err.message;

    try {
        let obj = JSON.parse(message);

        if (obj.message && obj.errors) {
            message = `${obj.message}: ${
                obj.errors.map((err: any) => err.message).join('\n')
            }`;
        }
    } catch (err) { /* ignore */ }

    process.stderr.write(chalk.bold.red(message) + '\n');

    if (withStackTrace && err.stack) {
        process.stderr.write(chalk.cyan(err.stack) + '\n');
    }
}
