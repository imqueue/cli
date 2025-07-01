/*!
 * IMQ-CLI library: travis
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
import * as NodeRSA from 'node-rsa';
import { TravisClient } from '@imqueue/travis';
import { sleep } from './node';

/**
 * Returns encrypted secure key for travis sensitive data.
 *
 * @see https://docs.travis-ci.com/user/encryption-keys/
 * @param {string} repository - git repository owner/name
 * @param {string} data - sensitive data to encrypt
 * @param {string} github_token - token if auth required (pro mode)
 * @return {Promise<string>}
 */
export async function travisEncrypt(
    repository: string,
    data: string,
    github_token?: string
): Promise<string> {
    const travis = new TravisClient({ pro: !!github_token });

    // istanbul ignore next
    if (github_token) {
        await travis.authenticate({ github_token });
    }

    const [owner, repo] = repository.split('/');
    const pem = await travis.repos(owner, repo).key.get();
    const rsa = new NodeRSA();

    rsa.setOptions({ encryptionScheme: 'pkcs1' });
    rsa.importKey(pem.key);

    return rsa.encrypt(Buffer.from(data, 'utf8'), 'base64');
}

// istanbul ignore next
/**
 * Tries perform travis sync
 *
 * @param {TravisClient} travis - authenticated client
 * @param {number} [retry] - current retry
 * @param {number} maxRetries - max number of retries
 * @param {number} delay - delay in milliseconds before result return
 */
export async function trySyncBuilds(
    travis: TravisClient,
    retry: number = 0,
    maxRetries: number = 3,
    delay: number = 2000
): Promise<boolean> {
    try {
        await travis.users.sync.post();
        await sleep(delay);
    } catch(err) {
        if (retry < maxRetries) {
            await sleep(delay);

            return trySyncBuilds(
                travis,
                ++retry,
                maxRetries
            );
        }

        return false;
    }

    return true;
}

// istanbul ignore next
/**
 * Enables builds for a given repository
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string} github_token
 * @return {Promise<void>}
 */
export async function enableBuilds(
    owner: string,
    repo: string,
    github_token: string,
    isPrivate: boolean
) {
    const travis = new TravisClient({ pro: isPrivate });

    await travis.authenticate({ github_token });
    await trySyncBuilds(travis);

    const hook = (await travis.hooks.get()).hooks.find((hook: any) =>
        hook.owner_name === owner && hook.name === repo);

    if (!hook) {
        return false;
    } else if (hook.active) {
        return true;
    }

    await travis.hooks(hook.id).put({ hook: { id: hook.id, active: true }});

    return true;
}
