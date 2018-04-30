/*!
 * IMQ-CLI library: config
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
        if (/^\s*(\[|\{)/.test(value)) {
            return JSON.parse(value);
        }
    }

    return value;
}
