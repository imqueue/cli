/*!
 * IMQ-CLI library: github
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
const GITHUB_API_URL = 'https://api.github.com';
const RX_DEPRECATION = /Deprecation:/;

/**
 * Error thrown for non-successful GitHub API responses, carrying the HTTP
 * status code of the response
 */
export class GithubApiError extends Error {
    public constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = 'GithubApiError';
    }
}

/**
 * Minimal GitHub REST v3 client over native fetch, covering the few
 * endpoints this cli uses (replaces @octokit/rest)
 */
export class Github {
    public constructor(private readonly token: string) {
        if (!token) {
            throw new TypeError(
                'Github auth token required, but was not given!',
            );
        }
    }

    /**
     * Performs a GitHub API request and returns the parsed JSON body.
     * Throws GithubApiError with the response status on non-2xx replies.
     *
     * @param {string} method - HTTP method to use
     * @param {string} path - API path, e.g. '/repos/{owner}/{repo}'
     * @param {object} [body] - JSON-serializable request payload
     * @return {Promise<any>}
     */
    public async request(
        method: string,
        path: string,
        body?: object,
    ): Promise<any> {
        const res = await fetch(`${GITHUB_API_URL}${path}`, {
            method,
            headers: {
                accept: 'application/vnd.github+json',
                authorization: `Bearer ${this.token}`,
                'user-agent': '@imqueue/cli',
                'x-github-api-version': '2022-11-28',
                ...(body ? { 'content-type': 'application/json' } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });

        const data =
            res.status === 204
                ? undefined
                : await res.json().catch(() => undefined);

        if (!res.ok) {
            throw new GithubApiError(
                (data as any)?.message || `HTTP ${res.status}`,
                res.status,
            );
        }

        return data;
    }

    public get(path: string): Promise<any> {
        return this.request('GET', path);
    }

    public post(path: string, body: object): Promise<any> {
        return this.request('POST', path, body);
    }

    public delete(path: string): Promise<any> {
        return this.request('DELETE', path);
    }
}

/**
 * Returns a team data for given organization, using github API
 * object which is already authenticated under some user
 *
 * @param {Github} github
 * @param {string} owner
 * @return {Promise<any>}
 */
export async function getTeam(github: Github, owner: string): Promise<any> {
    try {
        const teams = await github.get(
            `/orgs/${encodeURIComponent(owner)}/teams`,
        );

        return (teams || []).shift() || null;
    } catch {
        return null;
    }
}

/**
 * Returns organization info for a given organization name
 * using a given github API object already authenticated by some user
 *
 * @param {Github} github
 * @param {string} owner
 * @return {Promise<any>}
 */
export async function getOrg(github: Github, owner: string): Promise<any> {
    try {
        return await github.get(`/orgs/${encodeURIComponent(owner)}`);
    } catch {
        return null;
    }
}

/**
 * Returns an authenticated instance of github API object
 *
 * @param {string} token
 * @return {Promise<Github>}
 */
export async function getInstance(token: string): Promise<Github> {
    return new Github(token);
}

/**
 * Creates empty github repository
 *
 * @param {string} url
 * @param {string} token
 * @param {string} description
 * @param {boolean} isPrivate
 * @return {Promise<void>}
 */
export async function createRepository(
    url: string,
    token: string,
    description: string,
    isPrivate: boolean = true,
) {
    const [owner, repo] = (url.split(':').reverse().shift() || '').split('/');

    if (!(repo && owner)) {
        throw new TypeError(`Given github url "${url}" is invalid!`);
    }

    const github = await getInstance(token);

    try {
        const repository = await github.get(
            `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
        );

        if (repository && repository.name === repo) {
            throw new Error('Repository already exists!');
        }
    } catch (err) {
        const status = (err as GithubApiError).status;

        if (status !== 404 && !RX_DEPRECATION.test((err as Error).message)) {
            throw err;
        }
    }

    await github.post(`/orgs/${encodeURIComponent(owner)}/repos`, {
        name: repo,
        private: isPrivate,
        auto_init: false,
        description,
    });
}
