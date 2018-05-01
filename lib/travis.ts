/*!
 * IMQ-CLI library: travis
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
import * as NodeRSA from 'node-rsa';

const Travis = require('travis-ci');
const version: string = '2.0.0';

/**
 * Returns travis instance
 *
 * @access private
 * @param {boolean} pro
 */
function getInstance(pro: boolean) {
    return new Travis({ version, pro });
}

// istanbul ignore next
/**
 * Returns true if username and password is defined, false otherwise
 *
 * @access private
 * @param {string} username
 * @param {string} password
 * @return {boolean}
 */
function isPro(username?: string, password?: string) {
    return !!(username && password);
}

// istanbul ignore next
/**
 * Loads key data for repository from travis
 *
 * @param {Travis} travis
 * @param {string} slug
 * @return {Promise<any>}
 */
async function loadKey(travis: any, slug: string): Promise<any> {
    const [owner, repo] = slug.split('/');

    return new Promise((resolve, reject) => {
        travis.repos(owner, repo).key.get(wrappedCallback(resolve, reject));
    });
}

// istanbul ignore next
/**
 * Performs travis authentication
 *
 * @access private
 * @param {Travis} travis
 * @param {string} username
 * @param {string} password
 * @return {Promise<boolean>}
 */
async function auth(travis: any, username: string, password: string) {
    try {
        await new Promise((resolve, reject) => {
            const options = { username, password };
            travis.authenticate(options, wrappedCallback(resolve, reject));
        });

        return true;
    }

    catch (err) {
        return false;
    }
}

// istanbul ignore next
/**
 * Fetches public encryption key from travis
 *
 * @access private
 * @param {string} slug
 * @param {string} username
 * @param {string} password
 * @return {Promise<string>}
 */
async function fetchKey(
    slug: string, username?: string, password?: string
): Promise<string> {
    const pro = isPro(username, password);
    const travis = getInstance(pro);

    if (pro && !await auth(travis, <string>username, <string>password)) {
        return '';
    }

    const data = await loadKey(travis, slug);

    return data && data.key || '';
}

// istanbul ignore next
/**
 * Builds and returns
 *
 * @access private
 * @param {Function} resolve
 * @param {Function} reject
 * @return {(err: Error, result: string) => any}
 */
function wrappedCallback(resolve: Function, reject: Function) {
    return (err: Error, result: string) => {
        if (err) return reject(err);
        resolve(result);
    };
}

/**
 * Returns encrypted secure key for travis sensitive data.
 *
 * @see https://docs.travis-ci.com/user/encryption-keys/
 * @param {string} repository - git repository owner/name
 * @param {string} data - sensitive data to encrypt
 * @param {string} [username] - travis username
 * @param {string} [password] - travis password
 * @return {Promise<string>}
 */
export async function travisEncrypt(
    repository: string,
    data: string,
    username?: string,
    password?: string
): Promise<string> {
    const pem = (await fetchKey(repository, username, password))
        .replace(/RSA PUBLIC KEY/g, 'PUBLIC KEY');

    return new NodeRSA(pem, 'pkcs8-public-pem').encrypt(data, 'base64');
}
