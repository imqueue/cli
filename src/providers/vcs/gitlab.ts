/*!
 * IMQ-CLI providers: vcs/gitlab
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

// overridable for self-managed GitLab (and integration testing)
const API = process.env.IMQ_GITLAB_API_URL || 'https://gitlab.com/api/v4';

/**
 * Performs a GitLab API request, returning parsed JSON (or undefined on 204),
 * throwing on non-2xx (except an allowed status the caller tolerates).
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
            'private-token': token,
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
        throw new Error((data as any)?.message || `GitLab HTTP ${res.status}`);
    }

    return data;
}

/**
 * GitLab VCS host. Creates a project under the authenticated user or, when the
 * namespace resolves to a group, under that group.
 */
export const gitlab: VcsHostProvider = {
    id: 'gitlab',
    title: 'GitLab',

    authSpec: { path: 'vcs.auth.token', describe: 'GitLab access token' },

    remoteUrl(
        namespace: string,
        name: string,
        proto: 'ssh' | 'https' = 'ssh',
    ): string {
        return proto === 'https'
            ? `https://gitlab.com/${namespace}/${name}.git`
            : `git@gitlab.com:${namespace}/${name}.git`;
    },

    webUrl(namespace: string, name: string): string {
        return `https://gitlab.com/${namespace}/${name}`;
    },

    bugsUrl(namespace: string, name: string): string {
        return `https://gitlab.com/${namespace}/${name}/-/issues`;
    },

    async createRepository(ctx: CreateContext): Promise<void> {
        const { namespace, auth, private: isPrivate } = ctx.config.vcs;

        if (!namespace || !auth?.token) {
            throw new TypeError(
                'GitLab namespace and token are required, but were not given!',
            );
        }

        // if the namespace is a group, create the project inside it
        const group = await api(
            'GET',
            `/groups/${encodeURIComponent(namespace)}`,
            auth.token,
            undefined,
            [404],
        );

        await api('POST', '/projects', auth.token, {
            name: ctx.name,
            path: ctx.name,
            visibility: isPrivate ? 'private' : 'public',
            description: ctx.description,
            ...(group?.id ? { namespace_id: group.id } : {}),
        });
    },

    async deleteRepository(ctx: CreateContext): Promise<void> {
        const { namespace, auth } = ctx.config.vcs;

        if (!namespace || !auth?.token) {
            return;
        }

        await api(
            'DELETE',
            `/projects/${encodeURIComponent(`${namespace}/${ctx.name}`)}`,
            auth.token,
            undefined,
            [404],
        );
    },
};
