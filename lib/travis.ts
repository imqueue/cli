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
import { TravisClient } from 'node-travis';

/**
 * Returns encrypted secure key for travis sensitive data.
 *
 * @see https://docs.travis-ci.com/user/encryption-keys/
 * @param {string} repository - git repository owner/name
 * @param {string} data - sensitive data to encrypt
 * @return {Promise<string>}
 */
export async function travisEncrypt(
    repository: string,
    data: string,
    github_token?: string
): Promise<string> {
    const travis = new TravisClient({ pro: !!github_token });

    if (travis.pro) {
        await travis.authenticate({ github_token });
    }

    const [owner, repo] = repository.split('/');
    const pem = await travis.repos(owner, repo).key.get();
    const rsa = new NodeRSA();
    const buf = Buffer.from(data, 'utf8');

    rsa.importKey(Buffer.from(pem.key, 'utf8'), 'public');
    rsa.setOptions({ encryptionScheme: 'pkcs1' });

    return rsa.encrypt(buf).toString('base64');
}
