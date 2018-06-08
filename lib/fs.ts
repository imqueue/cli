/*!
 * IMQ-CLI library: fs
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
