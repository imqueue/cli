/*!
 * @imqueue/cli Unit Tests: VCS providers (gitlab, bitbucket)
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
import { afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import '../../mocks/index.js';
import { gitlab } from '../../../src/providers/vcs/gitlab.js';
import { bitbucket } from '../../../src/providers/vcs/bitbucket.js';
import { github } from '../../../src/providers/vcs/github.js';

function ctx(provider: string, namespace: string): any {
    return {
        name: 'my-svc',
        description: 'test svc',
        config: {
            vcs: {
                provider,
                namespace,
                private: true,
                auth: { token: 'tok' },
            },
        },
    };
}

function stubFetch(
    handler: (url: string, init: any) => { status: number; body?: any },
) {
    return mock.method(globalThis, 'fetch', async (url: any, init: any) => {
        const { status, body } = handler(String(url), init || {});

        return {
            ok: status >= 200 && status < 300,
            status,
            json: async () => body,
        } as any;
    });
}

describe('vcs providers', () => {
    afterEach(() => mock.restoreAll());

    describe('gitlab', () => {
        it('should build ssh/web/bugs urls', () => {
            assert.equal(
                gitlab.remoteUrl('grp', 'my-svc'),
                'git@gitlab.com:grp/my-svc.git',
            );
            assert.equal(
                gitlab.webUrl('grp', 'my-svc'),
                'https://gitlab.com/grp/my-svc',
            );
            assert.equal(
                gitlab.bugsUrl('grp', 'my-svc'),
                'https://gitlab.com/grp/my-svc/-/issues',
            );
        });

        it('should create under a group when the namespace is a group', async () => {
            const calls: any[] = [];

            stubFetch((url, init) => {
                calls.push({ url, init });
                if (init.method === 'GET') {
                    return { status: 200, body: { id: 42 } };
                }
                return { status: 201, body: { id: 1 } };
            });

            await gitlab.createRepository(ctx('gitlab', 'grp'));

            const post = calls.find(c => c.init.method === 'POST');

            assert.match(post.url, /\/projects$/);
            assert.equal(JSON.parse(post.init.body).namespace_id, 42);
            assert.equal(JSON.parse(post.init.body).visibility, 'private');
        });

        it('should create under the user when namespace is not a group', async () => {
            const calls: any[] = [];

            stubFetch((url, init) => {
                calls.push({ url, init });
                if (init.method === 'GET') {
                    return { status: 404 };
                }
                return { status: 201, body: {} };
            });

            await gitlab.createRepository(ctx('gitlab', 'me'));

            const post = calls.find(c => c.init.method === 'POST');

            assert.equal(JSON.parse(post.init.body).namespace_id, undefined);
        });
    });

    describe('github', () => {
        it('should default a repository to private when unspecified', async () => {
            const calls: any[] = [];

            stubFetch((url, init) => {
                calls.push({ url, init });

                // the repo does not exist yet, then the org create succeeds
                return (init.method || 'GET') === 'GET'
                    ? { status: 404 }
                    : { status: 201, body: {} };
            });

            const c = ctx('github', 'acme');

            c.config.vcs.private = undefined; // not specified -> defaults true

            await github.createRepository(c);

            const post = calls.find(x => x.init.method === 'POST');

            assert.ok(post, 'a repository POST was made');
            assert.equal(JSON.parse(post.init.body).private, true);
        });
    });

    describe('bitbucket', () => {
        it('should build ssh/web/bugs urls', () => {
            assert.equal(
                bitbucket.remoteUrl('ws', 'my-svc'),
                'git@bitbucket.org:ws/my-svc.git',
            );
            assert.equal(
                bitbucket.webUrl('ws', 'my-svc'),
                'https://bitbucket.org/ws/my-svc',
            );
        });

        it('should POST a repository to the workspace', async () => {
            const calls: any[] = [];

            stubFetch((url, init) => {
                calls.push({ url, init });
                return { status: 200, body: {} };
            });

            await bitbucket.createRepository(ctx('bitbucket', 'ws'));

            assert.match(calls[0].url, /\/repositories\/ws\/my-svc$/);
            assert.equal(calls[0].init.method, 'POST');
            assert.equal(JSON.parse(calls[0].init.body).scm, 'git');
            assert.equal(JSON.parse(calls[0].init.body).is_private, true);
        });

        it('should throw with a clear message on api failure', async () => {
            stubFetch(() => ({
                status: 401,
                body: { error: { message: 'Unauthorized' } },
            }));

            await assert.rejects(
                () => bitbucket.createRepository(ctx('bitbucket', 'ws')),
                /Unauthorized/,
            );
        });
    });
});
