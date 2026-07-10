/*!
 * IMQ-CLI command: config get
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
import { styleText } from 'node:util';
import { type Argv, type Arguments } from 'yargs';
import { printError } from '../../lib/index.js';
import { spawnSync, type SpawnSyncReturns } from 'child_process';
import { join, resolve } from 'path';
import { readdirSync, readFileSync } from 'fs';
import { Console } from 'console';
import { pathToFileURL } from 'node:url';

const BASE_SERVICE_NAME = 'IMQService';
let PROGRAM: string = '';
let ROOT_DIRECTORY = process.cwd();

/**
 * NOTE: Creating new console to avoid output from imported services
 */
const logger = new Console(process.stdout, process.stderr);

/**
 * Checks if any of the given module exports is a class derived (directly
 * or transitively) from IMQService
 *
 * @param {object} moduleExports - loaded module namespace or exports object
 * @returns {boolean} - true if a service class export is found
 */
export function containsServiceClass(moduleExports: object): boolean {
    for (const [prop, exported] of Object.entries(moduleExports)) {
        if (!prop.includes('Service') || typeof exported !== 'function') {
            continue;
        }

        let parent = Object.getPrototypeOf(exported);

        while (typeof parent === 'function' && parent.name) {
            if (parent.name === BASE_SERVICE_NAME) {
                return true;
            }

            parent = Object.getPrototypeOf(parent);
        }
    }

    return false;
}

/**
 * Resolves the entry module of a package directory to a file URL, honoring
 * the exports map when present and falling back to main / index.js
 *
 * @param {string} servicePath - path to directory, which contains service
 * @returns {string | null} - entry file URL or null if not a package
 */
export function resolveServiceEntry(servicePath: string): string | null {
    try {
        const pkg = JSON.parse(
            readFileSync(join(servicePath, 'package.json'), 'utf8'),
        );
        const dot = pkg.exports?.['.'];
        const entry =
            (typeof dot === 'string' ? dot : (dot?.import ?? dot?.default)) ??
            pkg.main ??
            'index.js';

        return pathToFileURL(resolve(servicePath, entry)).href;
    } catch {
        return null;
    }
}

/**
 * Checks if directory contains service
 * @param {string} servicePath - path to directory, which contains service
 * @returns {Promise<boolean>} -
 *              returns true if directory contains service, or false instead
 */
async function isFolderContainsService(servicePath: string): Promise<boolean> {
    const entryUrl = resolveServiceEntry(servicePath);

    if (!entryUrl) {
        return false;
    }

    const originalLogger = console.log;

    try {
        console.log = () => undefined;
        process.chdir(servicePath);

        const service = await import(entryUrl);

        return containsServiceClass(service);
    } catch {
        return false;
    } finally {
        console.log = originalLogger;
        process.chdir(ROOT_DIRECTORY);
    }
}

/**
 * Walks through array of folders paths and executes git flow
 *
 * @param {string[]} paths - array of paths to folders with services
 * @param {Arguments} args - cli args
 * @returns {void}
 */
function walkThroughFolders(paths: string[], args: Arguments) {
    for (const path of paths) {
        // noinspection TypeScriptValidateTypes
        logger.log(styleText('blue', `\nService: ${path}`));
        execGitFlow(path, args);
    }
}

/**
 * Changes current branch to passed
 * @param {string} servicePath - path to directory, which contains service
 * @param {string} branch
 * @returns {SpawnSyncReturns<Buffer>}
 */
function gitCheckout(
    servicePath: string,
    branch: string,
): SpawnSyncReturns<Buffer> {
    logger.log(`Switching on branch ${branch}...`);
    return spawnSync('git', ['checkout', branch], {
        cwd: servicePath,
        stdio: 'pipe',
    });
}

/**
 * Pulls changes from repository
 * @param {string} servicePath - path to directory, which contains service
 * @returns {SpawnSyncReturns<Buffer>}
 */
function gitPull(servicePath: string): SpawnSyncReturns<Buffer> {
    logger.log('Execution git pull...');
    return spawnSync(`git`, ['pull'], {
        cwd: servicePath,
        stdio: 'pipe',
    });
}

/**
 * Changes version of package
 * @param {string} servicePath - path to directory, which contains service
 * @param {string} version - version which should be changed
 * @returns {SpawnSyncReturns<Buffer>}
 */
function changeVersion(
    servicePath: string,
    version: string,
): SpawnSyncReturns<Buffer> {
    logger.log(`Execute npm version ${version}`);
    return spawnSync('npm', ['version', version], {
        cwd: servicePath,
        stdio: 'pipe',
    });
}

/**
 * Pushes changes to repository
 * @param {string} servicePath - path to directory, which contains service
 * @returns {SpawnSyncReturns<Buffer>}
 */
function gitPush(servicePath: string): SpawnSyncReturns<Buffer> {
    logger.log('Execution git push...');
    return spawnSync('git', ['push', '--follow-tags'], {
        cwd: servicePath,
        stdio: 'pipe',
    });
}

/**
 * Handles response from executed command
 * @param {SpawnSyncReturns<Buffer>} response -
 *                              response from executing command
 * @returns {number | null}
 */
function handleSpawnResponse(
    response: SpawnSyncReturns<Buffer>,
): number | null {
    if (response.status !== 0 || response.error) {
        // noinspection TypeScriptValidateTypes
        logger.log(
            styleText(
                'red',
                response.stderr?.toString() ||
                    response.error?.message ||
                    `Command failed with status ${response.status}`,
            ),
        );
    }

    return response.status;
}

/**
 * Executes git flow with next sequence
 *  1. git checkout <branch>
 *  2. git pull
 *  3. npm version <version>
 *  4. git push --follow-tags
 * @param {string} servicePath - path to directory, which contains service
 * @param {Arguments} args - cli args
 * @returns {void}
 */
function execGitFlow(servicePath: string, args: Arguments): void {
    let response: SpawnSyncReturns<Buffer>;

    response = gitCheckout(servicePath, args.branch as string);

    if (handleSpawnResponse(response)) {
        return;
    }

    response = gitPull(servicePath);

    if (handleSpawnResponse(response)) {
        return;
    }

    response = changeVersion(servicePath, args.npmVersion as string);

    if (handleSpawnResponse(response)) {
        return;
    }

    response = gitPush(servicePath);
    if (handleSpawnResponse(response)) {
        return;
    }
    // noinspection TypeScriptValidateTypes
    logger.log(styleText('green', 'Done!'));
}

/**
 * Walks through folders and check if each folder contains service
 *
 * @param {string} path - path to root folder with services
 * @returns {Promise<string[]>} - array of folders with services
 */
async function getServicesFolders(path: string): Promise<string[]> {
    const folders: string[] = [];
    path = resolve(path);

    // NOTE: Check if we call update-version from service folder
    if (await isFolderContainsService(path)) {
        folders.push(path);
    } else {
        for (const dir of readdirSync(path)) {
            const pathToService = resolve(path, dir);

            if (await isFolderContainsService(pathToService)) {
                folders.push(pathToService);
            }
        }
    }

    return folders;
}

// noinspection JSUnusedGlobalSymbols
export const { command, describe, builder, handler } = {
    command: 'update-version <path> [branch] [version]',
    describe:
        'Updates services under given path with new version tag ' +
        'and automatically pushes changes to repository, triggering builds.',

    async builder(yargs: Argv) {
        PROGRAM = (await yargs.argv).$0;
        return yargs
            .option('b', {
                alias: 'branch',
                default: 'master',
                describe: 'The branch to checkout and use during update.',
            })
            .option('n', {
                alias: 'npm-version',
                default: 'prerelease',
                describe:
                    'NPM version to update (major|minor|patch|prerelease).',
            })
            .describe('path', 'Path to directory containing services.');
    },

    async handler(argv: Arguments) {
        try {
            const folders = await getServicesFolders(argv.path as string);
            walkThroughFolders(folders, argv);
        } catch (err) {
            printError(err as Error);
        }
    },
};
