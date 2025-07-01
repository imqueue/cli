/*!
 * IMQ-CLI Unit Tests: github
 *
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
 */
import '../mocks';
import { expect } from 'chai';
import { uuid } from '@imqueue/rpc';
import * as github from '../../lib/github';
import { config as envConfig } from 'dotenv';

envConfig();

xdescribe('github', function () {
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
