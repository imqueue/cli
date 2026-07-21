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
// github / bitbucket: a single user/org/workspace slug
const RX_NS = /^[-_a-z0-9]+$/i;
// gitlab: dotted names and nested groups (group/subgroup/...) are valid
const RX_NS_GITLAB = /^[-_.a-z0-9]+(?:\/[-_.a-z0-9]+)*$/i;
// a token is any non-empty run of non-whitespace characters
const RX_TOKEN = /^\S+$/;

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
 * Checks if a given string satisfies the namespace rules for the VCS host.
 * GitLab additionally allows dotted names and nested groups (`group/subgroup`);
 * github/bitbucket accept a single slug.
 *
 * @param {string} ns
 * @param {string} [provider] - vcs provider id (defaults to the strict slug)
 * @return {boolean}
 */
export function isNamespace(ns: string, provider?: string) {
    return (provider === 'gitlab' ? RX_NS_GITLAB : RX_NS).test(ns);
}

/**
 * Checks if a given string is a valid GitHub auth token
 *
 * @param {string} token
 * @return {boolean}
 */
export function isGithubToken(token: string) {
    return RX_TOKEN.test(token);
}

/**
 * @deprecated Misspelled alias of {@link isGithubToken}, kept for
 * backward compatibility.
 *
 * @param {string} token
 * @return {boolean}
 */
export function isGuthubToken(token: string) {
    return isGithubToken(token);
}
