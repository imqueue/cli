/*!
 * @imqueue/cli library: config
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
    existsSync as exists,
    chmodSync as chmod,
} from 'fs';
import { touch } from './fs.js';
import { CONFIG_PATH } from './constants.js';

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

    try {
        return JSON.parse(configText);
    } catch (err) {
        // a corrupted config file must not crash every command with a raw
        // SyntaxError - fail with an actionable message instead
        throw new Error(
            `Malformed @imqueue config at ${CONFIG_PATH}: ` +
                `${(err as Error).message}. ` +
                'Fix the JSON or run `imq config init` to recreate it.',
        );
    }
}

/**
 * Saves given config object to config file
 *
 * @param {IMQCLIConfig} config
 */
export function saveConfig(config: IMQCLIConfig) {
    const configText = JSON.stringify(config, null, 2) + '\n';

    if (!exists(CONFIG_PATH)) {
        touch(CONFIG_PATH, configText);
    } else {
        write(CONFIG_PATH, configText);
    }

    // the config may hold secrets (tokens, docker password) - keep it private
    try {
        chmod(CONFIG_PATH, 0o600);
    } catch {
        /* best effort - not all filesystems support chmod */
    }
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
            case 'true':
                return true;
            case 'false':
                return false;
            case 'null':
                return null;
            case 'undefined':
                return undefined;
        }

        if (/^\s*(\[|\{)/.test(value)) {
            return JSON.parse(value);
        }
    }

    return value;
}
