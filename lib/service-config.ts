/*!
 * IMQ-CLI library: service-config
 *
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
import { readFileSync as read, writeFileSync as write, existsSync } from 'fs';
import { resolve } from './path.js';
import type { IMQCLIConfig } from './config.js';

/**
 * Per-service config file, committed into a generated service. Holds the
 * choices made for that service (vcs/ci/registry/packages) and acts as the
 * per-service override layer that wins over the global config.
 */
export const SERVICE_CONFIG_FILENAME = '.imqrc.json';

/**
 * Resolves the per-service config file path for a given service directory.
 *
 * @param {string} dir - service directory
 * @return {string}
 */
export function serviceConfigPath(dir: string): string {
    return resolve(dir, SERVICE_CONFIG_FILENAME);
}

/**
 * Loads the per-service config from a service directory. Returns an empty
 * object when the file is absent or unreadable/broken (never throws).
 *
 * @param {string} dir - service directory
 * @return {IMQCLIConfig}
 */
export function loadServiceConfig(dir: string): IMQCLIConfig {
    const path = serviceConfigPath(dir);

    if (!existsSync(path)) {
        return {};
    }

    try {
        const text = read(path, { encoding: 'utf8' });

        return text ? JSON.parse(text) : {};
    } catch {
        return {};
    }
}

/**
 * Saves the per-service config into a service directory.
 *
 * @param {string} dir - service directory
 * @param {IMQCLIConfig} config - config object to write
 */
export function saveServiceConfig(dir: string, config: IMQCLIConfig): void {
    write(serviceConfigPath(dir), JSON.stringify(config, null, 2) + '\n', {
        encoding: 'utf8',
    });
}
