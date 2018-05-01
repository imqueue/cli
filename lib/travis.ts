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
type TravisEncrypt = (
    slug: string,
    data: string,
    username: string | undefined,
    password: string | undefined,
    callback: Function
) => string;

const travisEncrypt: TravisEncrypt = require('@rstacruz/travis-encrypt');

/**
 * Returns encrypted secure key for travis sensitive data.
 *
 * @see https://docs.travis-ci.com/user/encryption-keys/
 * @param {string} repository - git repository name
 * @param {string} data - sensitive data to encrypt
 * @param {string} [username] - github username
 * @param {string} [password] - github password
 * @return {Promise<string>}
 */
export async function encrypt(
    repository: string,
    data: string,
    username?: string,
    password?: string
): Promise<string> {
    return new Promise<string>((resolve, reject) =>
        travisEncrypt(
            repository,
            data,
            username,
            password,
            (err: Error, blob: string) => {
                if (err) return reject(err);
                resolve(blob);
            }
        )
    );
}
