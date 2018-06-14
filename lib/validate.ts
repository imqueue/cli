/*!
 * IMQ-CLI library: validate
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

const RX_EMAIL = /^[-a-z0-9.]+@[-a-z0-9.]+$/i;
const RX_NS = /^[-_a-z-0-9]+$/i;
const RX_TOKEN = /^[a-f0-9]{40}$/;

/**
 * Checks if a given string email-like
 *
 * @param {string} email
 * @return {boolean}
 */
export function isEmail(email: string) {
    return RX_EMAIL.test(email);
}

/**
 * Checks if a given string satisfying namespace rules
 *s
 * @param {string} ns
 * @return {boolean}
 */
export function isNamespace(ns: string) {
    return RX_NS.test(ns);
}

/**
 * Checks if a given string a valid GitHub auth token
 *
 * @param {string} token
 * @return {boolean}
 */
export function isGuthubToken(token: string) {
    return RX_TOKEN.test(token);
}
