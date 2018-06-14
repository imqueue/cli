/*!
 * IMQ-CLI Unit Tests: validate
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
import { expect } from "chai";
import { isEmail, isNamespace, isGuthubToken } from '../../lib';

describe('validate', function() {
    describe('isEmail()', () => {
        it('should be a function', () => {
            expect(typeof isEmail).equals('function');
        });

        it('should properly check given email string', () => {
            expect(isEmail('a@b')).equals(true);
            expect(isEmail('a.b@b.net')).equals(true);
            expect(isEmail('a-c0@b.dot')).equals(true);
            expect(isEmail('a#b')).equals(false);
            expect(isEmail('ab')).equals(false);
        });
    });

    describe('isNamespace()', () => {
        it('should be a function', () => {
            expect(typeof isNamespace).equals('function');
        });

        it('should properly check if a given string valid namespace', () => {
            expect(isNamespace('f57f%')).equals(false);
            expect(isNamespace('f57f')).equals(true);
            expect(isNamespace('djslkdj')).equals(true);
            expect(isNamespace('imqueue')).equals(true);
        });
    });

    describe('isGuthubToken()', () => {
        it('should be a function', () => {
            expect(typeof isGuthubToken).equals('function');
        });

        it('should properly validate token syntax', () => {
            expect(isGuthubToken('af456af456af456af456af456af456af456af456'))
                .equals(true);
            expect(isGuthubToken('af456af456af4af456af456af456af456af456'))
                .equals(false);
            expect(isGuthubToken('af456af456af456af456aFF56af456af456af456'))
                .equals(false);
            expect(isGuthubToken('af456af456af456af456of456af456af456af456'))
                .equals(false);
            expect(isGuthubToken('af456af456af456a!af456af456af456af456'))
                .equals(false);
        });
    });
});
