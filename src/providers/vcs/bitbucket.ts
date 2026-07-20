/*!
 * IMQ-CLI providers: vcs/bitbucket
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

const API = 'https://api.bitbucket.org/2.0';

/**
 * Performs a Bitbucket API request with a bearer token (workspace/repo access
 * token). Returns parsed JSON, tolerating an allowed status.
 */
async function api(
    method: string,
    path: string,
    token: string,
    body?: object,
    allow: number[] = [],
): Promise<any> {
    const res = await fetch(`${API}${path}`, {
        method,
        headers: {
            authorization: `Bearer ${token}`,
            ...(body ? { 'content-type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (allow.includes(res.status)) {
        return undefined;
    }

    const data =
        res.status === 204
            ? undefined
            : await res.json().catch(() => undefined);

    if (!res.ok) {
        throw new Error(
            (data as any)?.error?.message || `Bitbucket HTTP ${res.status}`,
        );
    }

    return data;
}

/**
 * Bitbucket Cloud VCS host. The namespace is the workspace slug.
 */
export const bitbucket: VcsHostProvider = {
    id: 'bitbucket',
    title: 'Bitbucket',

    authSpec: { path: 'vcs.auth.token', describe: 'Bitbucket access token' },

    remoteUrl(
        namespace: string,
        name: string,
        proto: 'ssh' | 'https' = 'ssh',
    ): string {
        return proto === 'https'
            ? `https://bitbucket.org/${namespace}/${name}.git`
            : `git@bitbucket.org:${namespace}/${name}.git`;
    },

    webUrl(namespace: string, name: string): string {
        return `https://bitbucket.org/${namespace}/${name}`;
    },

    bugsUrl(namespace: string, name: string): string {
        return `https://bitbucket.org/${namespace}/${name}/issues`;
    },

    async createRepository(ctx: CreateContext): Promise<void> {
        const { namespace, auth, private: isPrivate } = ctx.config.vcs;

        if (!namespace || !auth?.token) {
            throw new TypeError(
                'Bitbucket workspace and token are required, but were not given!',
            );
        }

        await api(
            'POST',
            `/repositories/${encodeURIComponent(namespace)}/${encodeURIComponent(ctx.name)}`,
            auth.token,
            {
                scm: 'git',
                is_private: isPrivate ?? true,
                description: ctx.description,
            },
        );
    },

    async deleteRepository(ctx: CreateContext): Promise<void> {
        const { namespace, auth } = ctx.config.vcs;

        if (!namespace || !auth?.token) {
            return;
        }

        await api(
            'DELETE',
            `/repositories/${encodeURIComponent(namespace)}/${encodeURIComponent(ctx.name)}`,
            auth.token,
            undefined,
            [404],
        );
    },
};
