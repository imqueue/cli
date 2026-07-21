/*!
 * @imqueue/cli Unit Tests: config
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
import { describe, it, before, beforeEach, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import '../mocks/index.js';
import {
    loadConfig,
    saveConfig,
    prepareConfigValue,
    configEmpty,
    CONFIG_PATH,
    touch,
} from '../../lib/index.js';
import * as fs from 'fs';

describe('config', () => {
    describe('loadConfig()', () => {
        beforeEach(() => {
            try {
                fs.unlinkSync(CONFIG_PATH);
            } catch {}
        });
        afterEach(() => {
            try {
                fs.unlinkSync(CONFIG_PATH);
            } catch {}
        });

        it('should be a function', () => {
            assert.equal(typeof loadConfig, 'function');
        });

        it('should return object even if config does not exist', () => {
            assert.equal(typeof loadConfig(), 'object');
        });

        it('should return actual object if config file exists', () => {
            const config = { a: 1, b: 'test', c: true };

            touch(CONFIG_PATH, JSON.stringify(config, null, 2));

            assert.deepEqual(loadConfig(), config);
        });

        it('should throw if config data broken', () => {
            const config = "{ a: 1, b: 'test', c: true }";

            touch(CONFIG_PATH, config);

            assert.throws(() => loadConfig());
        });
    });

    describe('saveConfig()', () => {
        before(() => {
            try {
                fs.unlinkSync(CONFIG_PATH);
            } catch {}
        });
        after(() => {
            try {
                fs.unlinkSync(CONFIG_PATH);
            } catch {}
        });

        it('should be a function', () => {
            assert.equal(typeof saveConfig, 'function');
        });

        it('should save if file does not exist', () => {
            const config = { a: 1, b: 'test', c: true };

            saveConfig(config);
            assert.deepEqual(loadConfig(), config);
        });

        it('should overwrite if file exists', () => {
            const config = { a: 123, b: 'test123', c: false };

            saveConfig(config);
            assert.deepEqual(loadConfig(), config);
        });
    });

    describe('prepareConfigValue()', () => {
        it('should be a function', () => {
            assert.equal(typeof prepareConfigValue, 'function');
        });

        it('should return true if "true" value passed', () => {
            assert.equal(prepareConfigValue('true'), true);
        });

        it('should return false if "false" value passed', () => {
            assert.equal(prepareConfigValue('false'), false);
        });

        it('should return null if "null" value passed', () => {
            assert.equal(prepareConfigValue('null'), null);
        });

        it('should return undefined if "undefined" value passed', () => {
            assert.equal(prepareConfigValue('undefined'), undefined);
        });

        it('should return array object if "[]" value passed', () => {
            assert.ok(prepareConfigValue('[]') instanceof Array);
        });

        it('should return object if "{}" value passed', () => {
            assert.ok(prepareConfigValue('{}') instanceof Object);
        });

        it('should return same object if non-string passed', () => {
            const obj = { a: 1, b: true };
            assert.equal(prepareConfigValue(obj), obj);
        });

        it('should throw if broken value passed', () => {
            assert.throws(() => prepareConfigValue('[}'));
        });
    });

    describe('configEmpty()', () => {
        before(() => {
            try {
                fs.unlinkSync(CONFIG_PATH);
            } catch {}
        });
        after(() => {
            try {
                fs.unlinkSync(CONFIG_PATH);
            } catch {}
        });

        it('should be a function', () => {
            assert.equal(typeof configEmpty, 'function');
        });

        it('should return true if config does not exist', () => {
            assert.equal(configEmpty(), true);
        });

        it('should return true if config exists but empty', () => {
            touch(CONFIG_PATH, '');
            assert.equal(configEmpty(), true);
        });

        it('should return true if config exists but contains empty object', () => {
            fs.writeFileSync(CONFIG_PATH, '{}');
            assert.equal(configEmpty(), true);
        });

        it('should return file if config exists and not empty', () => {
            saveConfig({ a: 1 });
            assert.equal(configEmpty(), false);
        });
    });
});
