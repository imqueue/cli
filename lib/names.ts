/*!
 * IMQ-CLI library: names
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
const RX_NON_ALLOWED = /[^-a-z0-9]/ig;
const RX_CAP = /([A-Z])/g;
const RX_DBL = /--/g;
const RX_FIRST = /^-/;
const RX_LETTER = /[a-z]/i;
const RX_SPLIT = /[^a-z0-9]/i;

/**
 * Transform "CamelCase" string to "camel-case" string
 *
 * @param {string} name
 * @return {string}
 */
export function dashed(name: string): string {
    name = name.trim();

    let dashed = name
        .replace(RX_NON_ALLOWED, '-')
        .replace(RX_CAP, m => `-${m.toLowerCase()}`)
        .replace(RX_DBL, '-')
        .replace(RX_FIRST, '')
    ;

    if (!RX_LETTER.test(name[0])) {
        dashed = `-${dashed}`;
    }

    return dashed;
}

/**
 * Transforms dashed string to CamelCase string
 *
 * @param {string} name
 * @return {string}
 */
export function camelCase(name: string): string {
    name = name.trim();

    return (!RX_LETTER.test(name[0]) ? name[0] : '') + name
        .split(RX_SPLIT)
        .map(s => s.substr(0, 1).toUpperCase() + s.substr(1))
        .join('');
}
