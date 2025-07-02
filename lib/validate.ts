/*!
 * IMQ-CLI library: validate
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
const RX_EMAIL = /^[-a-z0-9.]+@[-a-z0-9.]+$/i;
const RX_NS = /^[-_a-z-0-9]+$/i;
const RX_TOKEN = /^.+$/;

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
