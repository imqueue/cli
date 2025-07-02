/*!
 * IMQ-CLI library: config
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
import {
    readFileSync as read,
    writeFileSync as write,
    existsSync as exists
} from 'fs';
import { touch } from './fs';
import { CONFIG_PATH } from './constants';

export interface IMQCLIConfig {
    [options: string]: any;
}

/**
 * Loads config from file and returns config object
 *
 * @return {IMQCLIConfig}
 */
export function loadConfig(): IMQCLIConfig {
    if (!exists(CONFIG_PATH)) {
        return {};
    }

    const configText = read(CONFIG_PATH, { encoding: 'utf8' });

    if (!configText) {
        return {};
    }

    return JSON.parse(configText);
}

/**
 * Saves given config object to config file
 *
 * @param {IMQCLIConfig} config
 */
export function saveConfig(config: IMQCLIConfig) {
    const configText = JSON.stringify(config, null, 2) + '\n';

    if (!exists(CONFIG_PATH)) {
        return touch(CONFIG_PATH, configText);
    }

    return write(CONFIG_PATH, configText);
}

/**
 * Checks if current config file contains empty config
 *
 * @return {boolean}
 */
export function configEmpty() {
   if (!exists(CONFIG_PATH)) {
       return true;
   }

   const config = loadConfig();

   return !(config && Object.keys(config).length);
}

/**
 * Prepares config value.
 * Actually it is used when the set command is called to cast
 * a given string value to a proper JSON-compatible object
 *
 * @param {any} value
 * @return {any}
 */
export function prepareConfigValue(value: any) {
    if (typeof value === 'string') {
        switch (value) {
            case 'true': return true;
            case 'false': return false;
            case 'null': return null;
            case 'undefined': return undefined;
        }

        // istanbul ignore else
        // noinspection RegExpSingleCharAlternation,RegExpRedundantEscape
        if (/^\s*(\[|\{)/.test(value)) {
            return JSON.parse(value);
        }
    }

    return value;
}
