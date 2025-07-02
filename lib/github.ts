/*!
 * IMQ-CLI library: github
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
import * as Github from '@octokit/rest';

const RX_DEPRECATION = /Deprecation:/;

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
        // noinspection TypeScriptUnresolvedFunction
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
    return new Github({ auth: `token ${token}` });
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
            // noinspection ExceptionCaughtLocallyJS
            throw new Error('Repository already exists!');
        }
    } catch(err) {
        if (err.code !== 404 && !RX_DEPRECATION.test(err.message)) {
            throw err;
        }
    }

    await (github.repos as any).createInOrg({
        org: owner,
        name: repo,
        private: isPrivate,
        auto_init: false,
        description,
    });
}
