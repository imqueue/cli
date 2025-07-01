/*!
 * IMQ-CLI library: path
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
import * as p from 'path';
import { OS_HOME } from './constants';

/**
 * Resolves given path to an absolute canonical path
 *
 * @param {...string[]} args
 */
export function resolve(...args: string[]) {
    const paths: string[] = [];

    for (let path of args) {
        if (path.charAt(0) === '~') {
            path = OS_HOME + path.substr(1);
        }

        paths.push(path);
    }

    return p.normalize(p.resolve.apply(p, paths));
}
