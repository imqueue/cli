/*!
 * IMQ-CLI library: template
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
import inquirer from 'inquirer';
import {
    TPL_HOME,
    CUSTOM_TPL_HOME,
    TPL_REPO,
    rmdir,
    resolve,
} from '.';
import * as fs from 'fs';
import { execSync } from 'child_process';
const commandExists = require('command-exists').sync;
const wordWrap = require('word-wrap');

/**
 * Wraps words of given text to match given char width, using given indentation
 *
 * @param {string} text
 * @param {number} width
 * @param {string} indent
 * @return {string}
 */
export function wrap(text: string, width = 80, indent = '') {
    return wordWrap(text, { width, indent });
}

/**
 * Checks if a git command available. If no - throws an error
 *
 * @throws Error
 */
export function checkGit() {
    if (!commandExists('git')) {
        throw new Error('Git required but is not installed!');
    }
}

// due to problematic testing of user-interaction
// istanbul ignore next
/**
 * Load IMQ templates from templates git repository
 *
 * @return {Promise<any>}
 */
export async function loadTemplates() {
    if (fs.existsSync(TPL_HOME)) {
        await updateTemplates();
    }

    else {
        checkGit();
        console.log('Loading IMQ templates, please, wait...');
        execSync(`git clone ${TPL_REPO} ${TPL_HOME}`);
    }

    return fs.readdirSync(TPL_HOME).reduce((res: any, next: any) => {
        const path = resolve(TPL_HOME, next);

        if (/^\./.test(next)) return res;

        if (fs.statSync(path).isDirectory()) {
            res[next] = path;
        }

        return res;
    }, {});
}

// due to problematic testing of user-interaction
// istanbul ignore next
/**
 * Updates local copy of templates repo from remote source
 *
 * @return {Promise<void>}
 */
export async function updateTemplates() {
    const cwd = process.cwd();

    process.chdir(TPL_HOME);
    checkGit();

    console.log('Updating IMQ templates, please, wait...');

    execSync('git pull');
    process.chdir(cwd);
}

// due to problematic testing of user-interaction
// istanbul ignore next
/**
 * Loads custom template from a given git repository
 *
 * @param {string} url
 * @return {Promise<string>}
 */
export async function loadTemplate(url: string): Promise<string> {
    const name = (url.split(/[\/]/).pop() || '').replace(/\.git$/, '');
    const path = resolve(CUSTOM_TPL_HOME, name);

    if (fs.existsSync(path)) {
        let answer = await inquirer.prompt<{ overwrite: boolean }>([{
            type: 'confirm',
            name: 'overwrite',
            message: 'Seems such template was already loaded, would you like ' +
            'to fetch it again and overwrite?',
            default: false
        }]);

        if (!answer.overwrite) {
            return path;
        }

        rmdir(path);
    }

    console.log(`Loading template from repository ${url}, please, wait...`);
    execSync(`git clone ${url} ${path}`);

    return path;
}
