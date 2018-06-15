/*!
 * IMQ-CLI library: names
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
