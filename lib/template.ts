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
} from './index.js';
import * as fs from 'fs';
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import { commandExists } from './node.js';
import { DEFAULT_TEMPLATES_REF } from './config-schema.js';

/**
 * Wraps words of given text to match given char width, using given indentation
 *
 * @param {string} text
 * @param {number} width
 * @param {string} indent
 * @return {string}
 */
export function wrap(text: string, width = 80, indent = '') {
    const lines: string[] = [];

    for (const paragraph of String(text).split('\n')) {
        let line = '';

        for (const word of paragraph.split(/\s+/).filter(Boolean)) {
            if (line && line.length + 1 + word.length > width) {
                lines.push(line);
                line = word;
            } else {
                line = line ? `${line} ${word}` : word;
            }
        }

        lines.push(line);
    }

    return lines.map(line => indent + line).join('\n');
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
/**
 * Load IMQ templates from templates git repository
 *
 * @return {Promise<any>}
 */
export async function loadTemplates(ref: string = DEFAULT_TEMPLATES_REF) {
    if (fs.existsSync(TPL_HOME)) {
        await updateTemplates(ref);
    } else {
        checkGit();
        console.log('Loading IMQ templates, please wait...');
        // pin the templates branch so new-CLI installs never pick up template
        // changes meant for older CLIs (and vice versa)
        execFileSync('git', ['clone', '--branch', ref, TPL_REPO, TPL_HOME], {
            stdio: 'inherit',
        });
    }

    return fs.readdirSync(TPL_HOME).reduce((res: any, next: any) => {
        const path = resolve(TPL_HOME, next);

        if (next.startsWith('.')) return res;

        if (fs.statSync(path).isDirectory()) {
            res[next] = path;
        }

        return res;
    }, {});
}

// due to problematic testing of user-interaction
/**
 * Updates local copy of templates repo from remote source
 *
 * @return {Promise<void>}
 */
export async function updateTemplates(ref: string = DEFAULT_TEMPLATES_REF) {
    checkGit();

    console.log('Updating IMQ templates, please wait...');

    // run in TPL_HOME via cwd (no global chdir to leak on failure); keep the
    // local copy usable if any step fails (e.g. offline)
    const git = (...args: string[]) =>
        execFileSync('git', args, { cwd: TPL_HOME, stdio: 'inherit' });

    try {
        git('fetch', 'origin', ref);
        git('checkout', '-B', ref, 'FETCH_HEAD');
    } catch {
        console.log('Could not update templates, using local copy for now...');
    }
}

// due to problematic testing of user-interaction
/**
 * Loads a custom template from a given git repository into a local cache. The
 * cache directory is namespaced by a hash of the URL so two different repos
 * that share a basename (e.g. two `template.git`) never collide. When a cached
 * copy exists it is reused; the "fetch again?" prompt is only offered in an
 * interactive session (a non-TTY run silently reuses the cache rather than
 * hanging or crashing at pipeline time).
 *
 * @param {string} url
 * @param {boolean} [interactive] - whether the re-fetch prompt may be shown
 * @return {Promise<string>}
 */
export async function loadTemplate(
    url: string,
    interactive = false,
): Promise<string> {
    const name = (url.split(/[/]/).pop() || '').replace(/\.git$/, '');
    const hash = createHash('sha1').update(url).digest('hex').slice(0, 8);
    const path = resolve(CUSTOM_TPL_HOME, `${name}-${hash}`);

    if (fs.existsSync(path)) {
        if (!interactive) {
            // non-interactive: reuse the cached copy rather than prompt
            return path;
        }

        let answer = await inquirer.prompt<{ overwrite: boolean }>([
            {
                type: 'confirm',
                name: 'overwrite',
                message:
                    'Seems such template was already loaded, would you like ' +
                    'to fetch it again and overwrite?',
                default: false,
            },
        ]);

        if (!answer.overwrite) {
            return path;
        }

        rmdir(path);
    }

    console.log(`Loading template from repository ${url}, please wait...`);
    execFileSync('git', ['clone', url, path], { stdio: 'inherit' });

    return path;
}
