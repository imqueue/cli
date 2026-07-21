/*!
 * @imqueue/cli library: ssh
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
import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Default private key basenames created by `ssh-keygen` across algorithms.
 * A `.pub` public key is also treated as evidence that keys are set up.
 */
const SSH_PRIVATE_KEY_NAMES = new Set([
    'id_rsa',
    'id_dsa',
    'id_ecdsa',
    'id_ecdsa_sk',
    'id_ed25519',
    'id_ed25519_sk',
    'identity',
]);

/**
 * Returns the SSH directory examined for keys: the `IMQ_SSH_DIR` override
 * (testing / non-standard homes) or `~/.ssh`.
 *
 * @return {string}
 */
export function sshDir(): string {
    return process.env.IMQ_SSH_DIR || join(homedir(), '.ssh');
}

/**
 * Detects whether the current machine user has any SSH keys set up, by looking
 * for a conventional private key (id_rsa, id_ed25519, …) or any public
 * (`*.pub`) key in the user's `.ssh` directory. Purely filesystem-based: it
 * makes no network calls and spawns no processes, so it is fast and safe to
 * call during interactive setup.
 *
 * @param {string} [dir] - ssh directory to inspect (defaults to `sshDir()`)
 * @return {boolean}
 */
export function hasSshKeys(dir: string = sshDir()): boolean {
    let entries: string[];

    try {
        entries = readdirSync(dir);
    } catch {
        // no ~/.ssh (or unreadable) -> no keys
        return false;
    }

    return entries.some(
        entry => SSH_PRIVATE_KEY_NAMES.has(entry) || entry.endsWith('.pub'),
    );
}

/**
 * Chooses the git transport to default to for pushing new services: `ssh` when
 * the user has SSH keys on this machine, otherwise `https`. This mirrors what
 * the user is most likely already able to authenticate with.
 *
 * @param {string} [dir] - ssh directory to inspect (defaults to `sshDir()`)
 * @return {'ssh' | 'https'}
 */
export function detectGitProtocol(dir?: string): 'ssh' | 'https' {
    return hasSshKeys(dir) ? 'ssh' : 'https';
}
