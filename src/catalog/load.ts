/*!
 * @imqueue/cli catalog: load
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
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'fs';
import { TPL_HOME, resolve } from '../../lib/index.js';
import type { Catalog } from './types.js';

const require = createRequire(import.meta.url);

// bundled catalog - always available (offline, local templates, tests)
const bundled: Catalog = require('../../lib/catalog.json');

/**
 * Loads the addon catalog. Prefers the catalog shipped in the templates repo
 * (so new addons can be published without a CLI release); falls back to the
 * catalog bundled with the CLI.
 *
 * @return {Catalog}
 */
export function loadCatalog(): Catalog {
    try {
        const fromTemplates = resolve(TPL_HOME, 'catalog.json');

        if (existsSync(fromTemplates)) {
            return JSON.parse(
                readFileSync(fromTemplates, { encoding: 'utf8' }),
            );
        }
    } catch {
        /* fall back to the bundled catalog */
    }

    return bundled;
}
