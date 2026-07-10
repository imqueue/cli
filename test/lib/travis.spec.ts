/*!
 * IMQ-CLI Unit Tests: travis
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
import {
    constants as cryptoConstants,
    generateKeyPairSync,
    privateDecrypt,
} from 'node:crypto';
import {
    enableBuilds,
    travisEncrypt,
    TravisApiError,
    TravisClient,
} from '../../lib/index.js';

describe('travis', () => {
    describe('TravisClient (offline)', () => {
        afterEach(() => mock.restoreAll());

        function stubFetch(
            handler: (url: string, init: any) => { status: number; body?: any },
        ) {
            const calls: Array<{ url: string; init: any }> = [];

            mock.method(globalThis, 'fetch', async (url: any, init: any) => {
                calls.push({ url: String(url), init });
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

            return calls;
        }

        it('should target org endpoint by default and pro when asked', async () => {
            const calls = stubFetch(() => ({ status: 200, body: {} }));

            await new TravisClient().request('GET', '/hooks');
            await new TravisClient({ pro: true }).request('GET', '/hooks');

            assert.ok(calls[0].url.startsWith('https://api.travis-ci.org/'));
            assert.ok(calls[1].url.startsWith('https://api.travis-ci.com/'));
        });

        it('should exchange github token and send it as auth header', async () => {
            const calls = stubFetch((url, init) => {
                if (url.endsWith('/auth/github')) {
                    assert.equal(
                        JSON.parse(init.body).github_token,
                        'gh-secret',
                    );
                    return {
                        status: 200,
                        body: { access_token: 'travis-token' },
                    };
                }
                return { status: 200, body: { hooks: [] } };
            });
            const travis = new TravisClient({ pro: true });

            await travis.authenticate({ github_token: 'gh-secret' });
            await travis.getHooks();

            assert.equal(
                calls[1].init.headers.authorization,
                'token travis-token',
            );
        });

        it('should throw TravisApiError with status on failures', async () => {
            stubFetch(() => ({
                status: 403,
                body: { error_message: 'access denied' },
            }));

            await assert.rejects(
                () => new TravisClient().getRepositoryKey('a', 'b'),
                (err: any) => {
                    assert.ok(err instanceof TravisApiError);
                    assert.equal(err.status, 403);
                    assert.equal(err.message, 'access denied');
                    return true;
                },
            );
        });

        it(
            'should encrypt data decryptable with the repository private ' +
                'key',
            async () => {
                const { publicKey, privateKey } = generateKeyPairSync('rsa', {
                    modulusLength: 2048,
                    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
                    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
                });
                stubFetch(url => {
                    assert.ok(url.endsWith('/repos/imqueue/cli/key'));
                    return { status: 200, body: { key: publicKey } };
                });

                const encrypted = await travisEncrypt('imqueue/cli', 'A=B');
                const decrypted = privateDecrypt(
                    {
                        key: privateKey,
                        padding: cryptoConstants.RSA_PKCS1_PADDING,
                    },
                    Buffer.from(encrypted, 'base64'),
                );

                assert.equal(decrypted.toString('utf8'), 'A=B');
            },
        );

        it('should enable an inactive hook through the hooks api', async () => {
            const calls = stubFetch((url, init) => {
                if (url.endsWith('/auth/github')) {
                    return { status: 200, body: { access_token: 't' } };
                }
                if (url.endsWith('/users/sync')) {
                    return { status: 200, body: {} };
                }
                if (url.endsWith('/hooks') && init.method === 'GET') {
                    return {
                        status: 200,
                        body: {
                            hooks: [
                                {
                                    id: 7,
                                    owner_name: 'imqueue',
                                    name: 'cli',
                                    active: false,
                                },
                            ],
                        },
                    };
                }
                return { status: 200, body: {} };
            });

            const enabled = await enableBuilds('imqueue', 'cli', 'gh', false);

            assert.equal(enabled, true);
            const put = calls.find(call => call.init.method === 'PUT');
            assert.ok(put);
            assert.ok(put.url.endsWith('/hooks/7'));
            assert.deepEqual(JSON.parse(put.init.body), {
                hook: { id: 7, active: true },
            });
        });

        it('should report false when the repository hook is missing', async () => {
            stubFetch(url => {
                if (url.endsWith('/auth/github')) {
                    return { status: 200, body: { access_token: 't' } };
                }
                if (url.endsWith('/hooks')) {
                    return { status: 200, body: { hooks: [] } };
                }
                return { status: 200, body: {} };
            });

            assert.equal(
                await enableBuilds('imqueue', 'missing', 'gh', false),
                false,
            );
        });
    });

    describe('travisEncrypt()', () => {
        it('should be a function', () => {
            assert.equal(typeof travisEncrypt, 'function');
        });

        it.skip('should not throw on existing public repo', async () => {
            let error: any = null;
            try {
                await travisEncrypt('imqueue/cli', 'a=b');
            } catch (err) {
                error = err;
            }
            assert.equal(error, null);
        });

        it('should throw if wrong repo or credentials', async () => {
            let error: any = null;
            try {
                await travisEncrypt('!@#$/%^&*', 'a=b');
            } catch (err) {
                error = err;
            }
            assert.ok(error instanceof Error);
        });

        it.skip('should return string value', async () => {
            assert.equal(
                typeof (await travisEncrypt('imqueue/cli', 'a=b')),
                'string',
            );
        });
    });
});
