/*!
 * @imqueue/cli providers: vcs/github
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
import type { CreateContext, VcsHostProvider } from '../types.js';
import { createRepository, Github } from '../../../lib/index.js';

/**
 * GitHub VCS host. Wraps the existing minimal GitHub REST client so the
 * create pipeline is host-agnostic.
 */
export const github: VcsHostProvider = {
    id: 'github',
    title: 'GitHub',

    authSpec: {
        path: 'vcs.auth.token',
        describe: 'GitHub auth token',
    },

    // GitHub HTTPS basic-auth: any username with the token as the password;
    // `x-access-token` is the documented convention (matches actions/checkout)
    httpAuthUser: 'x-access-token',

    remoteUrl(
        namespace: string,
        name: string,
        proto: 'ssh' | 'https' = 'ssh',
    ): string {
        return proto === 'https'
            ? `https://github.com/${namespace}/${name}.git`
            : `git@github.com:${namespace}/${name}.git`;
    },

    webUrl(namespace: string, name: string): string {
        return `https://github.com/${namespace}/${name}`;
    },

    bugsUrl(namespace: string, name: string): string {
        return `https://github.com/${namespace}/${name}/issues`;
    },

    async createRepository(ctx: CreateContext): Promise<void> {
        const { namespace, auth, private: isPrivate } = ctx.config.vcs;

        if (!namespace) {
            throw new TypeError('GitHub namespace required, but is empty!');
        }

        if (!auth?.token) {
            throw new TypeError(
                'GitHub auth token required, but was not given!',
            );
        }

        // createRepository accepts an "owner/name" (or full ssh url) form and
        // falls back to /user/repos for personal accounts
        await createRepository(
            `${namespace}/${ctx.name}`,
            auth.token,
            ctx.description,
            isPrivate ?? true,
        );
    },

    async deleteRepository(ctx: CreateContext): Promise<void> {
        const { namespace, auth } = ctx.config.vcs;

        if (!namespace || !auth?.token) {
            return;
        }

        const gh = new Github(auth.token);

        await gh.delete(
            `/repos/${encodeURIComponent(namespace)}/${encodeURIComponent(
                ctx.name,
            )}`,
        );
    },
};
