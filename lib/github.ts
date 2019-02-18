/*!
 * IMQ-CLI library: github
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
import * as Github  from '@octokit/rest';

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
        return ((await (github.orgs as any).getTeams({
            org: owner
        }) || /* istanbul ignore next */{} as any)
        .data || /* istanbul ignore next */[])
        .shift();
    } catch (err) {
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
        return (await github.orgs.get({ org: owner })).data;
    }

    catch (err) {
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
    const github = new Github({
        auth: `token ${token}`
    });

    return github;
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
    const [owner, repo]  = (url.split(':').reverse().shift() ||
        /* istanbul ignore next */'').split('/');

    if (!(repo && owner)) {
        throw new TypeError(`Given github url "${url}" is invalid!`);
    }

    const github = await getInstance(token);

    try {
        const repository = await github.repos.get({ owner, repo });

        // istanbul ignore else
        if (repository && repository.data && repository.data.name === repo) {
            throw new Error('Repository already exists!');
        }
    } catch(err) {
        if (err.code !== 404) {
            throw err;
        }
    }

    const team = await getTeam(github, owner);
    const org = await getOrg(github, owner);

    const repository = await (github.repos as any).create({
        auto_init: false,
        description,
        name: repo,
        private: isPrivate
    });

    if (org && team && owner !== (repository.data.owner as any).login) {
        try {
            await (github.repos as any).transfer({
                new_owner: owner,
                owner: (repository.data.owner as any).login,
                repo,
                team_ids: [team.id]
            });
        } catch (err) {
            // make sure we clean up garbage
            // istanbul ignore next
            await github.repos.delete({
                owner: (repository.data.owner as any).login,
                repo
            });
            // istanbul ignore next
            throw err;
        }
    }
}
