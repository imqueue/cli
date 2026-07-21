/*!
 * IMQ-CLI library: error
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

// that is just a printing function, no need to do specific tests
/**
 * Prints error message to standard error output. Also sets the process exit
 * code to 1, since every call site is a fatal handler catch - this is what
 * makes failed commands observable to scripts and CI (a command that reports
 * an error must not exit 0).
 *
 * @param {Error} err - error to display message from
 * @param {boolean} [withStackTrace] - if true will printError error stack
 */
export function printError(err: Error, withStackTrace: boolean = false) {
    process.exitCode = 1;

    let message: string = err.message;

    try {
        let obj = JSON.parse(message);

        if (obj.message && obj.errors) {
            message = `${obj.message}: ${obj.errors
                .map((err: any) => err.message)
                .join('\n')}`;
        }
    } catch {
        /* ignore */
    }

    process.stderr.write(styleText(['bold', 'red'], message) + '\n');

    if (withStackTrace && err.stack) {
        process.stderr.write(styleText('cyan', err.stack) + '\n');
    }
}
