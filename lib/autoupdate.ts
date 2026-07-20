/*!
 * I Message Queue Command Line Interface
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
import { execSync } from 'child_process';
import inquirer, { type QuestionCollection } from 'inquirer';
import { createRequire } from 'node:module';
import * as semver from 'semver';

const require = createRequire(import.meta.url);

const pkg = require('../package.json');

/**
 * Performs check if local version is latest
 */
export async function checkForUpdate() {
    try {
        // allow users/CI to skip the network round-trip entirely
        if (process.env.IMQ_NO_UPDATE_CHECK) {
            return;
        }

        // non-interactive runs (pipes, CI) must never hang on a prompt
        if (!process.stdin.isTTY || !process.stdout.isTTY) {
            return;
        }

        const remoteVersion = execSync(`npm show ${pkg.name} version`, {
            // don't block the CLI indefinitely on a slow/unreachable registry
            timeout: 3000,
        })
            .toString('utf8')
            .trim();
        const localVersion = pkg.version.trim();

        // prompt only for a real upgrade, not when running a newer
        // (e.g. not yet published) local version
        if (semver.gt(remoteVersion, localVersion)) {
            const answer: { update: boolean } = await inquirer.prompt<{
                update: boolean;
            }>([
                {
                    type: 'confirm',
                    name: 'update',
                    message: `New version ${remoteVersion} of ${
                        pkg.name
                    } available. Would you like to update?`,
                    default: true,
                },
            ] as QuestionCollection);

            if (answer.update) {
                update();
            }
        }
    } catch {
        /* ignore */
    }
}

/**
 * Executes update command for this package
 */
function update() {
    try {
        console.log('Updating, please, wait...');
        execSync(`npm i -g ${pkg.name}`);
        console.log('Update success, please, re-run your command again.');
        process.exit(0);
    } catch (err) {
        console.error(`UPDATE ERROR:`, err);
    }
}
