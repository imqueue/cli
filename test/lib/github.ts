/*!
 * IMQ-CLI Unit Tests: github
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
import '../mocks';
import { expect } from 'chai';
import * as github from '../../lib/github';
import { config as envConfig } from 'dotenv';

envConfig();

describe('github', () => {
    describe('getInstance()', () => {
        it('should be a function', () => {
            expect(typeof github.getInstance).equals('function');
        });

        it('should not throw if valid token given', async () => {
            const token = String(process.env.GITHUB_AUTH_TOKEN);
            let error = null;

            try {
                await github.getInstance(token);
            } catch (err) {
                error = err;
            }

            expect(error).to.be.null;
        });

        it('should trow if invalid token given', async () => {
            const token = '';
            let error = null;

            try {
                await github.getInstance(token);
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
            const token = String(process.env.GITHUB_AUTH_TOKEN);
            const git = await github.getInstance(token);
            const team = await github.getTeam(git, 'imqueue');

            expect(team).to.be.ok;
            expect(team.id).not.to.be.undefined;
        });
    });

    describe('getOrg()', () => {
        it('should be a function', () => {
            expect(typeof github.getOrg).equals('function');
        });
    });

    describe('createRepository()', () => {
        it('should be a function', () => {
            expect(typeof github.createRepository).equals('function');
        });
    });
});
