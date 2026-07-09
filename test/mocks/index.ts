/*!
 * IMQ-CLI Unit Test Mocks Exports
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
// sandbox all cli file locations before anything loads lib/constants
process.env.IMQ_CLI_HOME = '/tmp';

const { mock } = await import('node:test');
const { commandExistsMock } = await import('./command-exists.js');
const { Redis } = await import('./redis.js');

// preloaded via `node --import ./test/mocks/index.js` so mocks are
// registered before any test file graph links (see package.json scripts)
mock.module('command-exists', {
    cache: false,
    defaultExport: commandExistsMock,
});
mock.module('ioredis', {
    cache: false,
    defaultExport: {
        __esModule: true,
        default: Redis,
        Redis,
    },
    namedExports: {
        Redis,
    },
});

export * from './logger.js';
export * from './redis.js';
