/*!
 * IMQ-CLI library: travis
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
import { constants as cryptoConstants, publicEncrypt } from 'node:crypto';
import { sleep } from './node.js';

/**
 * Error thrown for non-successful Travis API responses, carrying the HTTP
 * status code of the response
 */
export class TravisApiError extends Error {
    public constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = 'TravisApiError';
    }
}

export interface TravisClientOptions {
    /**
     * Use the pro endpoint (api.travis-ci.com) instead of the open-source
     * one (api.travis-ci.org)
     */
    pro?: boolean;
}

/**
 * Minimal Travis CI API client over native fetch, covering the few
 * endpoints this cli uses (replaces the @imqueue/travis package)
 */
export class TravisClient {
    private readonly baseUrl: string;
    private accessToken?: string;

    public constructor(options?: TravisClientOptions) {
        this.baseUrl = options?.pro
            ? 'https://api.travis-ci.com'
            : 'https://api.travis-ci.org';
    }

    /**
     * Performs a Travis API request and returns the parsed JSON body.
     * Throws TravisApiError with the response status on non-2xx replies.
     *
     * @param {string} method - HTTP method to use
     * @param {string} path - API path, e.g. '/repos/{owner}/{repo}/key'
     * @param {object} [body] - JSON-serializable request payload
     * @return {Promise<any>}
     */
    public async request(
        method: string,
        path: string,
        body?: object,
    ): Promise<any> {
        const res = await fetch(`${this.baseUrl}${path}`, {
            method,
            headers: {
                accept: 'application/vnd.travis-ci.2.1+json',
                'user-agent': 'Travis @imqueue/cli',
                ...(this.accessToken
                    ? { authorization: `token ${this.accessToken}` }
                    : {}),
                ...(body ? { 'content-type': 'application/json' } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });

        const data =
            res.status === 204
                ? undefined
                : await res.json().catch(() => undefined);

        if (!res.ok) {
            throw new TravisApiError(
                (data as any)?.error_message ||
                    (data as any)?.error ||
                    `HTTP ${res.status}`,
                res.status,
            );
        }

        return data;
    }

    /**
     * Exchanges a github token for a travis access token and uses it for
     * all subsequent requests
     *
     * @param {{ github_token: string }} params
     * @return {Promise<void>}
     */
    public async authenticate(params: { github_token: string }): Promise<void> {
        const data = await this.request('POST', '/auth/github', params);

        this.accessToken = (data || {}).access_token;
    }

    /**
     * Returns the repository public key used for encrypting secure values
     *
     * @param {string} owner
     * @param {string} repo
     * @return {Promise<{ key: string }>}
     */
    public getRepositoryKey(
        owner: string,
        repo: string,
    ): Promise<{ key: string }> {
        return this.request(
            'GET',
            `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
                repo,
            )}/key`,
        );
    }

    /**
     * Triggers synchronization of the authenticated user's repositories
     *
     * @return {Promise<any>}
     */
    public syncUsers(): Promise<any> {
        return this.request('POST', '/users/sync');
    }

    /**
     * Returns the authenticated user's repository hooks
     *
     * @return {Promise<{ hooks: any[] }>}
     */
    public getHooks(): Promise<{ hooks: any[] }> {
        return this.request('GET', '/hooks');
    }

    /**
     * Updates the given hook's active state
     *
     * @param {number} id - hook identifier
     * @param {boolean} active - desired state
     * @return {Promise<any>}
     */
    public updateHook(id: number, active: boolean): Promise<any> {
        return this.request('PUT', `/hooks/${id}`, { hook: { id, active } });
    }
}

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
    github_token?: string,
): Promise<string> {
    const travis = new TravisClient({ pro: !!github_token });

    // istanbul ignore next
    if (github_token) {
        await travis.authenticate({ github_token });
    }

    const [owner, repo] = repository.split('/');
    const pem = await travis.getRepositoryKey(owner, repo);

    // travis expects RSAES-PKCS1-v1_5 encryption with the repository
    // public key
    return publicEncrypt(
        {
            key: pem.key,
            padding: cryptoConstants.RSA_PKCS1_PADDING,
        },
        Buffer.from(data, 'utf8'),
    ).toString('base64');
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
    delay: number = 2000,
): Promise<boolean> {
    try {
        await travis.syncUsers();
        await sleep(delay);
    } catch {
        if (retry < maxRetries) {
            await sleep(delay);

            return trySyncBuilds(travis, ++retry, maxRetries);
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
    isPrivate: boolean,
) {
    const travis = new TravisClient({ pro: isPrivate });

    await travis.authenticate({ github_token });
    await trySyncBuilds(travis);

    const hook = (await travis.getHooks()).hooks.find(
        (item: any) => item.owner_name === owner && item.name === repo,
    );

    if (!hook) {
        return false;
    } else if (hook.active) {
        return true;
    }

    await travis.updateHook(hook.id, true);

    return true;
}
