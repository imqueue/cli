/*!
 * IMQ-CLI Unit Tests: github
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
import { describe, it } from 'node:test';
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
                await github.createRepository(url, token, 'IMQ-CLI test repo');
                const data = await git.repos.get({ owner, repo });
                assert.ok(data);
                assert.equal(data.name, repo);
                assert.equal(data.owner.login, owner);
            } catch (err) {}
            try {
                // cleanup
                await git.repos.delete({ owner, repo });
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
                    'IMQ-CLI test repo',
                    false,
                );
                const data = await git.repos.get({ owner, repo });
                assert.ok(data);
                assert.equal(data.name, repo);
                assert.equal(data.owner.login, owner);
            } catch (err) {}
            try {
                // cleanup
                await git.repos.delete({ owner, repo });
            } catch (err) {
                console.error(err);
            }
        });

        it('should throw if invalid url given', async () => {
            try {
                await github.createRepository(
                    'j032',
                    token,
                    'IMQ-CLI test repo',
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
                await github.createRepository(url, token, 'IMQ-CLI test repo');
                await github.createRepository(url, token, 'IMQ-CLI test repo');
            } catch (err) {
                assert.ok(err instanceof Error);
                assert.equal(err.message, 'Repository already exists!');
            }
            try {
                // cleanup
                await git.repos.delete({ owner, repo });
            } catch (err) {
                console.error(err);
            }
        });
    });
});
