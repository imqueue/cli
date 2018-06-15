/*!
 * IMQ-CLI Unit Tests: github
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
import '../mocks';
import { expect } from 'chai';
import { uuid } from '@imqueue/rpc';
import * as github from '../../lib/github';
import { config as envConfig } from 'dotenv';

envConfig();

describe('github', function () {
    this.timeout(30000);

    const token = String(process.env.GITHUB_AUTH_TOKEN);

    describe('getInstance()', () => {
        it('should be a function', () => {
            expect(typeof github.getInstance).equals('function');
        });

        it('should not throw if valid token given', async () => {
            let error = null;

            try {
                await github.getInstance(token);
            } catch (err) {
                error = err;
            }

            expect(error).to.be.null;
        });

        it('should trow if invalid token given', async () => {
            let error = null;

            try {
                await github.getInstance('');
            } catch (err) {
                error = err;
            }

            expect(error).not.to.be.null;
        });
    });

    describe('getTeam()', () => {
        it('should be a function', () => {
            expect(typeof github.getTeam).equals('function');
        });

        it('should return team object for a logged-in user', async () => {
            const git = await github.getInstance(token);
            const team = await github.getTeam(git, 'imqueue');

            expect(team).to.be.ok;
            expect(team.id).not.to.be.undefined;
        });

        it('should return null if there is no team', async () => {
            const git = await github.getInstance(token);
            const team = await github.getTeam(git, 'Mikhus');

            expect(team).to.be.null;
        });
    });

    describe('getOrg()', () => {
        it('should be a function', () => {
            expect(typeof github.getOrg).equals('function');
        });

        it('should return organization if it exists', async () => {
            const git = await github.getInstance(token);
            const org = await github.getOrg(git, 'imqueue');

            expect(org).to.be.ok;
            expect(org.name).equals('imqueue');
        });

        it('should return null if there is no team', async () => {
            const git = await github.getInstance(token);
            const org = await github.getOrg(git, 'Mikhus');

            expect(org).to.be.null;
        });
    });

    describe('createRepository()', () => {
        it('should be a function', () => {
            expect(typeof github.createRepository).equals('function');
        });

        it('should create repository in user space if asked', async () => {
            const owner = 'Mikhus';
            const repo = uuid();
            const url = `git@github.com:${owner}/${repo}`;
            const git: any = await github.getInstance(token);

            try {
                await github.createRepository(url, token, 'IMQ-CLI test repo');
                const data = await git.repos.get({ owner, repo });
                expect(data).to.be.ok;
                expect(data.name).equals(repo);
                expect(data.owner.login).equals(owner);
            } catch (err) {}
            try {
                // cleanup
                await git.repos.delete({ owner, repo });
            } catch (err) { console.error(err); }
        });

        it('should create repository in org space if asked', async () => {
            const owner = 'imqueue';
            const repo = uuid();
            const url = `git@github.com:${owner}/${repo}`;
            const git: any = await github.getInstance(token);

            try {
                await github.createRepository(
                    url, token, 'IMQ-CLI test repo', false
                );
                const data = await git.repos.get({ owner, repo });
                expect(data).to.be.ok;
                expect(data.name).equals(repo);
                expect(data.owner.login).equals(owner);
            } catch (err) {}
            try {
                // cleanup
                await git.repos.delete({ owner, repo });
            } catch (err) { console.error(err); }
        });

        it('should throw if invalid url given', async () => {
            try {
                await github.createRepository(
                    'j032', token, 'IMQ-CLI test repo'
                );
            } catch (err) {
                expect(err).instanceof(TypeError);
                expect(err.message).match(/url .*? is invalid/);
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
                expect(err).instanceof(Error);
                expect(err.message).equals('Repository already exists!');
            }
            try {
                // cleanup
                await git.repos.delete({ owner, repo });
            } catch (err) { console.error(err); }
        });
    });
});
