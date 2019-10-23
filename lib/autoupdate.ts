/*!
 * I Message Queue Command Line Interface
 *
 * Copyright (c) 2018, imqueue.com <support@imqueue.com>
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
