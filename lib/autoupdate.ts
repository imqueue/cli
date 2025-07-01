/*!
 * I Message Queue Command Line Interface
 *
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
 */
import { execSync } from 'child_process';
import * as inquirer from 'inquirer';

const pkg = require('../package.json');

// istanbul ignore next
/**
 * Performs check if local version is latest
 */
export async function checkForUpdate() {
    try {
        const remoteVersion = execSync(`npm show ${pkg.name} version`)
            .toString('utf8').trim();
        const localVersion = pkg.version.trim();

        if (remoteVersion !== localVersion) {
            const answer: { update: boolean } = await inquirer.prompt<{
                update: boolean;
            }>([{
                type: 'confirm',
                name: 'update',
                message: `New version ${remoteVersion} of ${
                    pkg.name} available. Would you like to update?`,
                default: true,
            }] as inquirer.QuestionCollection);

            if (answer.update) {
                update();
            }
        }
    } catch (err) {
        /* ignore */
    }
}

// istanbul ignore next
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
