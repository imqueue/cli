/*!
 * IMQ-CLI Unit Tests: travis
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
import { travisEncrypt } from '../../lib';

describe('travis', function() {
    this.timeout(30000);

    describe('travisEncrypt()', () => {
        it('should be a function', () => {
            expect(typeof travisEncrypt).equals('function');
        });

        it('should not throw on existing public repo', async () => {
            let error: any = null;
            try {
                await travisEncrypt('imqueue/cli', 'a=b');
            }
            catch (err) {
                error = err;
            }
            expect(error).equals(null);
        });

        it('should throw if wrong repo or credentials', async () => {
            let error: any = null;
            try {
                await travisEncrypt('!@#$/%^&*', 'a=b');
            }
            catch (err) {
                error = err;
            }
            expect(error).to.be.instanceOf(Error);
        });

        it('should return string value', async () => {
            expect(typeof await travisEncrypt('imqueue/cli', 'a=b'))
                .equals('string');
        });
    });
});
