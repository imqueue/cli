/*!
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
import '../mocks/index.js';
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    appendFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    rmSync,
    truncateSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as log from '../../src/log.js';
import { VAR_HOME } from '../../lib/index.js';

describe('service log', () => {
    let varHome: string;

    beforeEach(() => {
        varHome = mkdtempSync(join(tmpdir(), 'imq-log-'));
    });
    afterEach(() => {
        rmSync(varHome, { recursive: true, force: true });
    });

    it('should be a valid command definition', () => {
        assert.equal(typeof log.command, 'string');
        assert.ok(log.command.includes('log'));
        assert.equal(typeof log.handler, 'function');
    });

    describe('resolveLogFiles()', () => {
        it('should return all log files, sorted, with no services', () => {
            writeFileSync(join(varHome, 'b.log'), 'b');
            writeFileSync(join(varHome, 'a.log'), 'a');
            writeFileSync(join(varHome, 'notes.txt'), 'x');

            assert.deepEqual(log.resolveLogFiles(varHome), [
                join(varHome, 'a.log'),
                join(varHome, 'b.log'),
            ]);
        });

        it('should resolve explicit services and warn on missing', () => {
            writeFileSync(join(varHome, 'auth.log'), 'a');

            const warnings: string[] = [];
            const files = log.resolveLogFiles(varHome, ['auth', 'ghost'], msg =>
                warnings.push(msg),
            );

            assert.deepEqual(files, [join(varHome, 'auth.log')]);
            assert.equal(warnings.length, 1);
            assert.ok(warnings[0].includes('ghost'));
        });

        it('should return an empty list for a missing var dir', () => {
            assert.deepEqual(log.resolveLogFiles(join(varHome, 'missing')), []);
        });
    });

    describe('cleanLogs()', () => {
        it('should delete only *.log files and report the count', () => {
            writeFileSync(join(varHome, 'a.log'), 'a');
            writeFileSync(join(varHome, 'b.log'), 'b');
            writeFileSync(join(varHome, 'keep.txt'), 'x');

            assert.equal(log.cleanLogs(varHome), 2);
            assert.deepEqual(readdirSync(varHome), ['keep.txt']);
        });

        it('should return 0 for a missing var dir', () => {
            assert.equal(log.cleanLogs(join(varHome, 'missing')), 0);
        });

        it('should scope the clean to named services', () => {
            writeFileSync(join(varHome, 'alpha.log'), 'a');
            writeFileSync(join(varHome, 'beta.log'), 'b');

            assert.equal(log.cleanLogs(varHome, ['alpha']), 1);
            assert.deepEqual(readdirSync(varHome), ['beta.log']);
        });
    });

    describe('labelText()', () => {
        it('should pass text through unchanged when prefix is off', () => {
            assert.equal(log.labelText('svc', 'hello\n', 0, false), 'hello\n');
        });

        it('should prefix every line and preserve trailing newline', () => {
            const out = log.labelText('auth', 'one\ntwo\n', 0, true);
            const lines = out.split('\n');

            // two content lines + trailing empty (kept newline)
            assert.equal(lines.length, 3);
            assert.ok(out.includes('auth'));
            assert.ok(out.includes('one'));
            assert.ok(out.includes('two'));
            assert.ok(out.endsWith('\n'));
        });
    });

    describe('tailFiles()', () => {
        it('should dump current contents when not following', async () => {
            writeFileSync(join(varHome, 'a.log'), 'alpha\n');
            writeFileSync(join(varHome, 'b.log'), 'beta\n');

            const chunks: string[] = [];

            await log.tailFiles(
                [join(varHome, 'a.log'), join(varHome, 'b.log')],
                { follow: false, prefix: true, out: c => chunks.push(c) },
            );

            const all = chunks.join('');

            assert.ok(all.includes('alpha'));
            assert.ok(all.includes('beta'));
            assert.ok(all.includes('[a]'));
            assert.ok(all.includes('[b]'));
        });

        it('should skip unreadable files without throwing', async () => {
            const chunks: string[] = [];

            await log.tailFiles([join(varHome, 'gone.log')], {
                follow: false,
                prefix: false,
                out: c => chunks.push(c),
            });

            assert.equal(chunks.join(''), '');
        });
    });

    describe('tailFiles() follow mode', () => {
        // deadline-poll the sink instead of fixed sleeps, so the test is fast
        // and not flaky
        async function waitFor(check: () => boolean, ms = 4000): Promise<void> {
            const started = Date.now();

            while (!check()) {
                if (Date.now() - started > ms) {
                    throw new Error('timed out waiting for follow output');
                }

                await new Promise(r => setTimeout(r, 20));
            }
        }

        it('should stream appended lines and survive truncation', async () => {
            const file = join(varHome, 'follow.log');

            writeFileSync(file, 'first\n');

            const chunks: string[] = [];
            const ac = new AbortController();
            const done = log.tailFiles([file], {
                follow: true,
                prefix: false,
                out: c => chunks.push(c),
                signal: ac.signal,
            });

            try {
                await waitFor(() => chunks.join('').includes('first'));

                // append while following
                appendFileSync(file, 'second\n');
                await waitFor(() => chunks.join('').includes('second'));

                // truncate + write fresh content: must reset and re-emit
                truncateSync(file, 0);
                appendFileSync(file, 'reborn\n');
                await waitFor(() => chunks.join('').includes('reborn'));
            } finally {
                ac.abort();
                await done;
            }
        });

        it('should not tear a multibyte char split across writes', async () => {
            const file = join(varHome, 'mb.log');

            writeFileSync(file, '');

            const chunks: string[] = [];
            const ac = new AbortController();
            const done = log.tailFiles([file], {
                follow: true,
                prefix: false,
                out: c => chunks.push(c),
                signal: ac.signal,
            });

            try {
                // '€' is E2 82 AC - append the first two bytes, then the rest
                const euro = Buffer.from('€ ok\n', 'utf8');

                appendFileSync(file, euro.subarray(0, 2));
                await new Promise(r => setTimeout(r, 60));
                appendFileSync(file, euro.subarray(2));
                await waitFor(() => chunks.join('').includes('€ ok'));

                assert.ok(!chunks.join('').includes('�'));
            } finally {
                ac.abort();
                await done;
            }
        });
    });

    describe('handler()', () => {
        it('should actually remove the scoped log via --clean', async () => {
            // the handler cleans the real (per-run, sandboxed) VAR_HOME; scope
            // to a unique service so we assert the file is truly gone rather
            // than that some unrelated dir still exists
            mkdirSync(VAR_HOME, { recursive: true });

            const svc = 'zeta-clean-spec';
            const file = join(VAR_HOME, `${svc}.log`);

            writeFileSync(file, 'to be removed\n');
            assert.ok(existsSync(file));

            await (log.handler as (a: unknown) => Promise<void>)({
                clean: true,
                services: [svc],
            });

            assert.ok(!existsSync(file));
        });
    });
});
