/*!
 * IMQ-CLI library: fs
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
import * as fs from 'fs';
import * as p from 'path';
import { resolve } from '.';

/**
 * Copy contents from source directory to destination directory
 * recursively
 *
 * @param {string} from
 * @param {string} to
 */
export function cpr(from: string, to: string) {
    from = resolve(from);
    to = resolve(to);

    if (!fs.existsSync(to)) {
        mkdirp(to);
    }

    fs.readdirSync(from).forEach(file => {
        const fromPath = resolve(from, file);
        const toPath = resolve(to, file);

        if (fs.statSync(fromPath).isDirectory()) {
            cpr(fromPath, toPath);
        }

        else {
            fs.copyFileSync(fromPath, toPath);
        }
    });
}

/**
 * Removes directory and all its content recursively
 *
 * @param {string} path
 */
export function rmdir(path: string) {
    let files = [];

    // istanbul ignore else
    if( fs.existsSync(path) ) {
        files = fs.readdirSync(path);

        files.forEach(file => {
            const curPath = resolve(path, file);

            if (fs.lstatSync(curPath).isDirectory()) {
                rmdir(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });

        fs.rmdirSync(path);
    }
}

/**
 * Silently recursively creates all directories in a given path
 *
 * @param {string} path - path to create
 */
export function mkdirp(path: string): void {
    try {
        fs.mkdirSync(path);
    }

    catch (err) {
        if (err.code === 'ENOENT') {
            mkdirp(p.dirname(path));
            return mkdirp(path);
        }

        // istanbul ignore if
        if (!fs.statSync(path).isDirectory()) {
            throw err;
        }
    }
}

/**
 * Silently creates a file under given file path.
 * If content of a file is omitted, will create an empty file.
 *
 * @param {string} path - path to file to create
 * @param {string} [content] - file contents to put in
 */
export function touch(
    path: string,
    // istanbul ignore next
    content: string = ''
): void {
    if (!fs.existsSync(path)) {
        mkdirp(p.dirname(path));
        fs.writeFileSync(path, content);
    }
}
