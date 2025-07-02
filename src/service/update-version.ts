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
import { Argv, Arguments } from 'yargs';
import * as chalk from 'chalk';
import { printError } from '../../lib';
import { spawnSync, SpawnSyncReturns } from 'child_process';
import { resolve } from 'path';
import { readdirSync } from 'fs';
import { Console } from 'console';

const BASE_SERVICE_NAME = 'IMQService';
let PROGRAM: string = '';
let ROOT_DIRECTORY = process.cwd();

/**
 * NOTE: Creating new console to avoid output from imported services
 */
const logger = new Console(process.stdout, process.stderr);

/**
 * Checks if directory contains service
 * @param {string} servicePath - path to directory, which contains service
 * @returns {boolean} -
 *              returns true if directory contains service, or false instead
 */
function isFolderContainsService(
    servicePath: string,
): boolean {
    const originalLogger = console.log;

    try {
        console.log = () => {};
        process.chdir(servicePath);

        const service = require(servicePath);

        for (const [prop, func] of Object.entries(service)) {
            if (!prop.includes('Service')) { continue; }

            // noinspection TypeScriptUnresolvedVariable
            return (func as any).__proto__.name === BASE_SERVICE_NAME;
        }

        process.chdir(ROOT_DIRECTORY);
    } catch (err) { /* ignore */ }

    console.log = originalLogger;

    return false;
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
        logger.log(chalk.blue('\nService:', path));
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
function gitPull(
    servicePath: string,
): SpawnSyncReturns<Buffer> {
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
function gitPush(
    servicePath: string,
): SpawnSyncReturns<Buffer> {
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
    if (response.status !== 0 || response.error && response.stderr) {
        // noinspection TypeScriptValidateTypes
        logger.log(chalk.red(response.stderr.toString()));
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
function execGitFlow(
    servicePath: string,
    args: Arguments,
): void {
    let response: SpawnSyncReturns<Buffer>;

    response = gitCheckout(servicePath, args.branch as string);

    if (handleSpawnResponse(response)) { return; }

    response = gitPull(servicePath);

    if (handleSpawnResponse(response)) { return; }

    response = changeVersion(servicePath, args.npmVersion as string);

    if (handleSpawnResponse(response)) { return; }

    response = gitPush(servicePath);
    if (handleSpawnResponse(response)) { return; }
    // noinspection TypeScriptValidateTypes
    logger.log(chalk.green('Done!'));
}

/**
 * Walks through folders and check if each folder contains service
 *
 * @param {string} path - path to root folder with services
 * @returns {string[]} - array of folders with services
 */
function getServicesFolders(
    path: string,
): string[] {
    const folders: string[] = [];
    path = resolve(path);

    // NOTE: Check if we call update-version from service folder
    if (isFolderContainsService(path)) {
        folders.push(path);
    } else {
        for (const dir of readdirSync(path)) {
            const pathToService = resolve(path, dir);
            const containsService = isFolderContainsService(
                pathToService,
            );

            if (containsService) { folders.push(pathToService) }
        }
    }

    return folders;
}

// noinspection JSUnusedGlobalSymbols
export const { command, describe, builder, handler } = {
    command: 'update-version <path> [branch] [version]',
    describe: 'Updates services under given path with new version tag ' +
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
                describe: 'NPM version to update (major|minor|patch|prerelease).'
            })
            .describe('path', 'Path to directory containing services.');
    },

    handler(argv: Arguments) {
        try {
            const folders = getServicesFolders(argv.path as string);
            walkThroughFolders(folders, argv);
        } catch (err) {
            printError(err);
        }
    }
};
