/*!
 * IMQ-CLI Unit Tests: config
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
import {
    loadConfig,
    saveConfig,
    prepareConfigValue,
    configEmpty,
    CONFIG_PATH,
    touch
} from '../../lib';
import * as fs from 'fs';

describe('config', () => {
    describe('loadConfig()', () => {
        beforeEach(() => { try { fs.unlinkSync(CONFIG_PATH) } catch (e) {} });
        afterEach(() => { try { fs.unlinkSync(CONFIG_PATH) } catch (e) {} });

        it('should be a function', () => {
            expect(typeof loadConfig).equals('function');
        });

        it('should return object even if config does not exist', () => {
            expect(typeof loadConfig()).equals('object');
        });

        it('should return actual object if config file exists', () => {
            const config = { a: 1, b: 'test', c: true };

            touch(CONFIG_PATH, JSON.stringify(config, null, 2));

            expect(loadConfig()).to.deep.equal(config);
        });

        it('should throw if config data broken', () => {
            const config = "{ a: 1, b: 'test', c: true }";

            touch(CONFIG_PATH, config);

            expect(() => loadConfig()).throws;
        });
    });

    describe('saveConfig()', () => {
        before(() => { try { fs.unlinkSync(CONFIG_PATH) } catch (e) {} });
        after(() => { try { fs.unlinkSync(CONFIG_PATH) } catch (e) {} });

        it('should be a function', () => {
            expect(typeof saveConfig).equals('function');
        });

        it('should save if file does not exist', () => {
            const config = { a: 1, b: 'test', c: true };

            saveConfig(config);
            expect(loadConfig()).to.deep.equal(config);
        });

        it('should overwrite if file exists', () => {
            const config = { a: 123, b: 'test123', c: false };

            saveConfig(config);
            expect(loadConfig()).to.deep.equal(config);
        });
    });

    describe('prepareConfigValue()', () => {
        it('should be a function', () => {
            expect(typeof prepareConfigValue).equals('function');
        });

        it('should return true if "true" value passed', () => {
            expect(prepareConfigValue('true')).equals(true);
        });

        it('should return false if "false" value passed', () => {
            expect(prepareConfigValue('false')).equals(false);
        });

        it('should return null if "null" value passed', () => {
            expect(prepareConfigValue('null')).equals(null);
        });

        it('should return undefined if "undefined" value passed', () => {
            expect(prepareConfigValue('undefined')).equals(undefined);
        });

        it('should return array object if "[]" value passed', () => {
            expect(prepareConfigValue('[]')).to.be.instanceOf(Array);
        });

        it('should return object if "{}" value passed', () => {
            expect(prepareConfigValue('{}')).to.be.instanceOf(Object);
        });

        it('should return same object if non-string passed', () => {
            const obj = { a: 1, b: true };
            expect(prepareConfigValue(obj)).equals(obj);
        });

        it('should throw if broken value passed', () => {
            expect(() => prepareConfigValue('[}')).throws;
        });
    });

    describe('configEmpty()', () => {
        before(() => { try { fs.unlinkSync(CONFIG_PATH) } catch (e) {} });
        after(() => { try { fs.unlinkSync(CONFIG_PATH) } catch (e) {} });

        it('should be a function', () => {
            expect(typeof configEmpty).equals('function');
        });

        it('should return true if config does not exist', () => {
            expect(configEmpty()).equals(true);
        });

        it('should return true if config exists but empty', () => {
            touch(CONFIG_PATH, '');
            expect(configEmpty()).equals(true);
        });

        it('should return true if config exists but contains empty object',
        () => {
            fs.writeFileSync(CONFIG_PATH, '{}');
            expect(configEmpty()).equals(true);
        });

        it('should return file if config exists and not empty', () => {
            saveConfig({ a: 1 });
            expect(configEmpty()).equals(false);
        });
    });
});
