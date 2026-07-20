/*!
 * IMQ-CLI providers: scm/git
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
import { execFileSync } from 'child_process';
import type { CreateContext, ScmProvider } from '../types.js';
import { commandExists } from '../../../lib/index.js';

/**
 * Git source control. Initializes the working copy, commits, wires the remote,
 * pushes on the repository's default branch, and tags the initial version.
 */
export const git: ScmProvider = {
    id: 'git',
    title: 'Git',

    async initAndPush(ctx: CreateContext, remoteUrl: string): Promise<void> {
        if (!commandExists('git')) {
            throw new Error('Git command expected, but is not installed!');
        }

        // no shell: urls/branches cannot be injected
        const run = (...args: string[]) =>
            execFileSync('git', args, { cwd: ctx.path, stdio: 'inherit' });
        const tag = `v${ctx.version}`;

        console.log('Committing changes...');
        run('init');

        // ensure a commit identity so `git commit`/`tag -a` never fail when
        // the user has no global git config; use the service author/email
        run('config', 'user.name', ctx.author || 'imqueue');
        run('config', 'user.email', ctx.email || 'support@imqueue.com');

        run('add', '.');
        run('commit', '-am', 'Initial commit');

        // honor the repo's configured default branch instead of "master"
        const branch =
            execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
                cwd: ctx.path,
            })
                .toString()
                .trim() || 'main';

        run('remote', 'add', 'origin', remoteUrl);
        run('push', 'origin', branch);

        console.log('Setting up version tag...');

        try {
            run('tag', '-d', tag);
        } catch {
            /* no local tag to drop */
        }

        try {
            run('push', 'origin', `:refs/tags/${tag}`);
        } catch {
            /* no remote tag to drop */
        }

        run('tag', '-fa', tag, '-m', `Tagging version ${tag}`);
        run('push', 'origin', branch, '--tags');
    },
};
