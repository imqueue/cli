/*!
 * IMQ-CLI Unit Tests: resolve
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
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../mocks/index.js';
import { resolveOption } from '../../lib/index.js';

describe('resolve', () => {
    describe('resolveOption() precedence', () => {
        const spec = {
            name: 'ci provider',
            flag: 'ci',
            path: 'ci.provider',
            fromLegacy: (g: any) => (g.useDocker ? 'travis' : undefined),
            default: 'github-actions',
        };

        it('should prefer a flag over everything else', async () => {
            const value = await resolveOption(spec, {
                flags: { ci: 'circleci' },
                service: { ci: { provider: 'gitlab-ci' } },
                global: { ci: { provider: 'travis' } },
            });

            assert.equal(value, 'circleci');
        });

        it('should prefer per-service over global', async () => {
            const value = await resolveOption(spec, {
                flags: {},
                service: { ci: { provider: 'circleci' } },
                global: { ci: { provider: 'travis' } },
            });

            assert.equal(value, 'circleci');
        });

        it('should use structured global before legacy derivation', async () => {
            const value = await resolveOption(spec, {
                global: { ci: { provider: 'circleci' }, useDocker: true },
            });

            assert.equal(value, 'circleci');
        });

        it('should fall back to legacy derivation', async () => {
            const value = await resolveOption(spec, {
                global: { useDocker: true },
            });

            assert.equal(value, 'travis');
        });

        it('should fall back to the default when nothing matches', async () => {
            assert.equal(
                await resolveOption(spec, { global: {} }),
                'github-actions',
            );
        });

        it('should treat empty-string flags as not provided', async () => {
            const value = await resolveOption(spec, {
                flags: { ci: '' },
                global: { ci: { provider: 'travis' } },
            });

            assert.equal(value, 'travis');
        });
    });

    describe('resolveOption() prompting', () => {
        const spec = {
            name: 'token',
            path: 'vcs.auth.token',
            prompt: async () => 'prompted-token',
        };

        it('should prompt only when interactive and nothing else matched', async () => {
            assert.equal(
                await resolveOption(spec, { interactive: true, global: {} }),
                'prompted-token',
            );
        });

        it('should not prompt when a value is already available', async () => {
            const value = await resolveOption(spec, {
                interactive: true,
                global: { vcs: { auth: { token: 'stored' } } },
            });

            assert.equal(value, 'stored');
        });

        it('should not prompt in non-interactive mode', async () => {
            assert.equal(
                await resolveOption(spec, { interactive: false, global: {} }),
                undefined,
            );
        });
    });

    describe('resolveOption() required & validate', () => {
        it('should throw when a required value is missing', async () => {
            await assert.rejects(
                () =>
                    resolveOption(
                        { name: 'namespace', required: true },
                        { global: {} },
                    ),
                /Missing required option "namespace"/,
            );
        });

        it('should throw when validation fails', async () => {
            await assert.rejects(
                () =>
                    resolveOption(
                        {
                            name: 'version',
                            flag: 'v',
                            validate: (x: string) => x.startsWith('1'),
                        },
                        { flags: { v: '2.0.0' } },
                    ),
                /Invalid value for option "version"/,
            );
        });

        it('should accept a value that passes validation', async () => {
            const value = await resolveOption(
                {
                    name: 'version',
                    flag: 'v',
                    validate: (x: string) => x.startsWith('1'),
                },
                { flags: { v: '1.2.3' } },
            );

            assert.equal(value, '1.2.3');
        });
    });
});
