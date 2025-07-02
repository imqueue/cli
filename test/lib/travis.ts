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
import '../mocks';
import { expect } from 'chai';
import { travisEncrypt } from '../../lib';

describe('travis', function() {
    this.timeout(30000);

    describe('travisEncrypt()', () => {
        it('should be a function', () => {
            expect(typeof travisEncrypt).equals('function');
        });

        xit('should not throw on existing public repo', async () => {
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

        xit('should return string value', async () => {
            expect(typeof await travisEncrypt('imqueue/cli', 'a=b'))
                .equals('string');
        });
    });
});
