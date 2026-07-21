/*!
 * @imqueue/cli Unit Tests: github
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
import { afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import '../mocks/index.js';
import { randomUUID as uuid } from 'node:crypto';
import * as github from '../../lib/github.js';

try {
    // native replacement for dotenv; throws when no .env file exists
    process.loadEnvFile();
} catch {
    /* no .env file - rely on the process environment */
}

function stubFetch(
    handler: (url: string, init: any) => { status: number; body?: any },
) {
    return mock.method(globalThis, 'fetch', async (url: any, init: any) => {
        const { status, body } = handler(String(url), init);

        return {
            ok: status >= 200 && status < 300,
            status,
            json: async () => {
                if (body === undefined) {
                    throw new Error('no body');
                }
                return body;
            },
        } as any;
    });
}

describe('github (offline)', () => {
    afterEach(() => mock.restoreAll());

    describe('getInstance()', () => {
        it('should throw on empty token', async () => {
            await assert.rejects(() => github.getInstance(''), TypeError);
        });

        it('should return a client for a non-empty token', async () => {
            const client = await github.getInstance('secret');

            assert.ok(client instanceof github.Github);
        });
    });

    describe('Github.request()', () => {
        it('should send bearer auth and parse json replies', async () => {
            let seen: any;
            stubFetch((url, init) => {
                seen = { url, init };
                return { status: 200, body: { hello: 'world' } };
            });

            const client = new github.Github('secret');
            const data = await client.get('/orgs/imqueue');

            assert.deepEqual(data, { hello: 'world' });
            assert.equal(seen.url, 'https://api.github.com/orgs/imqueue');
            assert.equal(seen.init.headers.authorization, 'Bearer secret');
        });

        it('should throw GithubApiError with status on failure', async () => {
            stubFetch(() => ({
                status: 404,
                body: { message: 'Not Found' },
            }));

            const client = new github.Github('secret');

            await assert.rejects(
                () => client.get('/repos/a/b'),
                (err: any) => {
                    assert.ok(err instanceof github.GithubApiError);
                    assert.equal(err.status, 404);
                    assert.equal(err.message, 'Not Found');
                    return true;
                },
            );
        });
    });

    describe('getTeam() [offline]', () => {
        it('should return the first team', async () => {
            stubFetch(() => ({
                status: 200,
                body: [{ id: 1, slug: 'devs' }, { id: 2 }],
            }));

            const client = new github.Github('secret');

            assert.deepEqual(await github.getTeam(client, 'imqueue'), {
                id: 1,
                slug: 'devs',
            });
        });

        it('should return null on api errors', async () => {
            stubFetch(() => ({ status: 404, body: { message: 'nope' } }));

            const client = new github.Github('secret');

            assert.equal(await github.getTeam(client, 'unknown'), null);
        });
    });

    describe('getOrg() [offline]', () => {
        it('should return org data', async () => {
            stubFetch(() => ({ status: 200, body: { login: 'imqueue' } }));

            const client = new github.Github('secret');

            assert.deepEqual(await github.getOrg(client, 'imqueue'), {
                login: 'imqueue',
            });
        });

        it('should return null on api errors', async () => {
            stubFetch(() => ({ status: 404, body: { message: 'nope' } }));

            const client = new github.Github('secret');

            assert.equal(await github.getOrg(client, 'unknown'), null);
        });
    });

    describe('createRepository() [offline]', () => {
        it('should throw on invalid url', async () => {
            await assert.rejects(
                () => github.createRepository('j032', 'secret', 'x'),
                TypeError,
            );
        });

        it('should create the repository when it does not exist', async () => {
            const calls: any[] = [];
            stubFetch((url, init) => {
                calls.push({ url, init });
                if (init.method === 'GET') {
                    return { status: 404, body: { message: 'Not Found' } };
                }
                return { status: 201, body: { name: 'repo' } };
            });

            await github.createRepository(
                'git@github.com:imqueue/repo',
                'secret',
                'test repo',
            );

            const post = calls.find(c => c.init.method === 'POST');

            assert.ok(post);
            assert.equal(post.url, 'https://api.github.com/orgs/imqueue/repos');
            assert.deepEqual(JSON.parse(post.init.body), {
                name: 'repo',
                private: true,
                auto_init: false,
                description: 'test repo',
            });
        });

        it('should fall back to /user/repos for a personal account', async () => {
            const calls: any[] = [];
            stubFetch((url, init) => {
                calls.push({ url, init });
                if (init.method === 'GET') {
                    return { status: 404, body: { message: 'Not Found' } };
                }
                // personal account is not an org - org POST 404s
                if (url.includes('/orgs/')) {
                    return { status: 404, body: { message: 'Not Found' } };
                }
                return { status: 201, body: { name: 'repo' } };
            });

            await github.createRepository(
                'git@github.com:Mikhus/repo',
                'secret',
                'test repo',
            );

            const posts = calls.filter(c => c.init.method === 'POST');

            assert.equal(posts.length, 2);
            assert.equal(
                posts[0].url,
                'https://api.github.com/orgs/Mikhus/repos',
            );
            assert.equal(posts[1].url, 'https://api.github.com/user/repos');
        });

        it('should throw if the repository already exists', async () => {
            stubFetch(() => ({ status: 200, body: { name: 'repo' } }));

            await assert.rejects(
                () =>
                    github.createRepository(
                        'git@github.com:imqueue/repo',
                        'secret',
                        'test repo',
                    ),
                { message: 'Repository already exists!' },
            );
        });

        it('should rethrow non-404 api errors', async () => {
            stubFetch(() => ({ status: 401, body: { message: 'Bad creds' } }));

            await assert.rejects(
                () =>
                    github.createRepository(
                        'git@github.com:imqueue/repo',
                        'secret',
                        'test repo',
                    ),
                { message: 'Bad creds' },
            );
        });
    });
});

describe.skip('github', () => {
    const token = String(process.env.GITHUB_AUTH_TOKEN);

    describe('getInstance()', () => {
        it('should be a function', () => {
            assert.equal(typeof github.getInstance, 'function');
        });

        it('should not throw if valid token given', async () => {
            let error = null;

            try {
                await github.getInstance(token);
            } catch (err) {
                error = err;
            }

            assert.equal(error, null);
        });

        it('should trow if invalid token given', async () => {
            let error = null;

            try {
                await github.getInstance('');
            } catch (err) {
                error = err;
            }

            assert.notEqual(error, null);
        });
    });

    describe('getTeam()', () => {
        it('should be a function', () => {
            assert.equal(typeof github.getTeam, 'function');
        });

        it('should return team object for a logged-in user', async () => {
            const git = await github.getInstance(token);
            const team = await github.getTeam(git, 'imqueue');

            assert.ok(team);
            assert.notEqual(team.id, undefined);
        });

        it('should return null if there is no team', async () => {
            const git = await github.getInstance(token);
            const team = await github.getTeam(git, 'Mikhus');

            assert.equal(team, null);
        });
    });

    describe('getOrg()', () => {
        it('should be a function', () => {
            assert.equal(typeof github.getOrg, 'function');
        });

        it('should return organization if it exists', async () => {
            const git = await github.getInstance(token);
            const org = await github.getOrg(git, 'imqueue');

            assert.ok(org);
            assert.equal(org.name, 'imqueue');
        });

        it('should return null if there is no team', async () => {
            const git = await github.getInstance(token);
            const org = await github.getOrg(git, 'Mikhus');

            assert.equal(org, null);
        });
    });

    describe('createRepository()', () => {
        it('should be a function', () => {
            assert.equal(typeof github.createRepository, 'function');
        });

        it('should create repository in user space if asked', async () => {
            const owner = 'Mikhus';
            const repo = uuid();
            const url = `git@github.com:${owner}/${repo}`;
            const git: any = await github.getInstance(token);

            try {
                await github.createRepository(url, token, '@imqueue/cli test repo');
                const data = await git.get(`/repos/${owner}/${repo}`);
                assert.ok(data);
                assert.equal(data.name, repo);
                assert.equal(data.owner.login, owner);
            } catch {}
            try {
                // cleanup
                await git.delete(`/repos/${owner}/${repo}`);
            } catch (err) {
                console.error(err);
            }
        });

        it('should create repository in org space if asked', async () => {
            const owner = 'imqueue';
            const repo = uuid();
            const url = `git@github.com:${owner}/${repo}`;
            const git: any = await github.getInstance(token);

            try {
                await github.createRepository(
                    url,
                    token,
                    '@imqueue/cli test repo',
                    false,
                );
                const data = await git.get(`/repos/${owner}/${repo}`);
                assert.ok(data);
                assert.equal(data.name, repo);
                assert.equal(data.owner.login, owner);
            } catch {}
            try {
                // cleanup
                await git.delete(`/repos/${owner}/${repo}`);
            } catch (err) {
                console.error(err);
            }
        });

        it('should throw if invalid url given', async () => {
            try {
                await github.createRepository(
                    'j032',
                    token,
                    '@imqueue/cli test repo',
                );
            } catch (err) {
                assert.ok(err instanceof TypeError);
                assert.match(err.message, /url .*? is invalid/);
            }
        });

        it('should throw proper error if repository exists', async () => {
            const owner = 'Mikhus';
            const repo = uuid();
            const url = `git@github.com:${owner}/${repo}`;
            const git: any = await github.getInstance(token);

            try {
                await github.createRepository(url, token, '@imqueue/cli test repo');
                await github.createRepository(url, token, '@imqueue/cli test repo');
            } catch (err) {
                assert.ok(err instanceof Error);
                assert.equal(err.message, 'Repository already exists!');
            }
            try {
                // cleanup
                await git.delete(`/repos/${owner}/${repo}`);
            } catch (err) {
                console.error(err);
            }
        });
    });
});
