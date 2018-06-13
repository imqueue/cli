/*!
 * IMQ-CLI library: fs
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
        return ((await github.orgs.getTeams({
            org: owner
        }) || {}).data || []).shift();
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
        return (await github.orgs.get({ org: owner }) || {}).data || {};
    }

    catch (err) {
        return null;
    }
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
    const [owner, repo]  = (url.split(':').reverse().shift() || '').split('/');

    if (!repo || !owner) {
        throw new TypeError(`Given github url "${url}" is invalid!`);
    }

    const github = new Github();

    await github.authenticate({ type: 'token', token });

    try {
        await github.repos.get({ owner, repo });
    } catch (err) {
        if (err.code !== 404) {
            throw new Error(
                'GitHub repository check failed with error: ' + err.message
            );
        }
    }

    const team = await getTeam(github, owner);
    const org = await getOrg(github, owner);
    const repository = await github.repos.create({
        auto_init: false,
        description,
        name: repo,
        private: isPrivate
    });

    if (org && team && owner !== repository.data.owner.login) {
        try {
            await github.repos.transfer({
                new_owner: owner,
                owner: repository.data.owner.login,
                repo,
                team_id: [team.id]
            });
        }

        catch (err) {
            if (err.errors) {
                if (err.errors.find((e: any) =>
                    /has no private repositories available/.test(e.message))
                ) {
                    throw new Error(
                        'Private repositories are disabled on your GitHub ' +
                        'account.'
                    );
                }
            }
            throw err;
        }
    }
}