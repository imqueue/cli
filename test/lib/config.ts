/*!
 * IMQ-CLI Unit Tests: config
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
