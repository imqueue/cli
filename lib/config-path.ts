/*!
 * IMQ-CLI library: config-path
 *
 * I'm Queue Software Project
 * Copyright (C) 2026  imqueue.com <support@imqueue.com>
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

/**
 * Splits a dot-path into its segments. A path without dots (every legacy
 * config key) yields a single segment, so legacy access is unchanged.
 *
 * @param {string} path - e.g. 'ci.provider' or 'author'
 * @return {string[]}
 */
function segments(path: string): string[] {
    return String(path).split('.').filter(Boolean);
}

/**
 * Reads a value from an object by a dot-path. Returns undefined if any
 * intermediate segment is missing or not an object.
 *
 * @param {any} obj - source object
 * @param {string} path - dot-path, e.g. 'registry.auth.user'
 * @return {any}
 */
export function getPath(obj: any, path: string): any {
    let cursor: any = obj;

    for (const key of segments(path)) {
        if (cursor === null || typeof cursor !== 'object') {
            return undefined;
        }

        cursor = cursor[key];
    }

    return cursor;
}

/**
 * Checks whether a dot-path resolves to a defined value on the given object.
 *
 * @param {any} obj - source object
 * @param {string} path - dot-path
 * @return {boolean}
 */
export function hasPath(obj: any, path: string): boolean {
    return getPath(obj, path) !== undefined;
}

/**
 * Sets a value on an object by a dot-path, creating intermediate plain
 * objects as needed. Mutates and returns the given object.
 *
 * @param {any} obj - target object (mutated)
 * @param {string} path - dot-path, e.g. 'ci.provider'
 * @param {any} value - value to set
 * @return {any} - the mutated target object
 */
export function setPath(obj: any, path: string, value: any): any {
    const keys = segments(path);

    if (!keys.length) {
        return obj;
    }

    let cursor: any = obj;

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];

        if (cursor[key] === null || typeof cursor[key] !== 'object') {
            cursor[key] = {};
        }

        cursor = cursor[key];
    }

    cursor[keys[keys.length - 1]] = value;

    return obj;
}
