/*!
 * IMQ-CLI library: services
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
import {
    type Dirent,
    existsSync,
    readdirSync,
    readFileSync,
    statSync,
} from 'fs';
import { join } from 'path';

/**
 * Matches a class declaration that extends IMQService or IMQClient - the
 * marker used to detect an @imqueue service (or client) in TypeScript source.
 * Mirrors the detection historically performed by the bash `imqctl`/`imqup`
 * tools via `grep -P 'extends\s+IMQ(Service|Client)\s*\{'`.
 */
const SERVICE_MARKER = /extends\s+IMQ(?:Service|Client)\s*\{/;

/**
 * Recursively collects `.ts` file paths under the given directory. Missing
 * directories yield an empty list rather than throwing, so scanning a repo
 * without a `src/` folder is safe.
 *
 * @param {string} dir - directory to walk
 * @return {string[]} - absolute (relative to input) paths of `.ts` files
 */
function tsFiles(dir: string): string[] {
    if (!existsSync(dir)) {
        return [];
    }

    const out: string[] = [];
    let entries: Dirent[];

    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        // unreadable directory (e.g. EACCES on one subtree) must not abort
        // discovery for every other service - skip it
        return out;
    }

    for (const entry of entries) {
        const full = join(dir, entry.name);

        if (entry.isDirectory()) {
            out.push(...tsFiles(full));
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
            out.push(full);
        }
    }

    return out;
}

/**
 * Checks whether a service directory contains an @imqueue service by scanning
 * its `src/` tree for a class extending IMQService or IMQClient. This is a
 * source-level check - it needs neither a build nor a module import, so it
 * works on freshly-cloned, uninstalled repositories.
 *
 * @param {string} serviceDir - path to a candidate service directory
 * @return {boolean} - true if the directory looks like an @imqueue service
 */
export function isServiceDir(serviceDir: string): boolean {
    for (const file of tsFiles(join(serviceDir, 'src'))) {
        try {
            if (SERVICE_MARKER.test(readFileSync(file, 'utf8'))) {
                return true;
            }
        } catch {
            /* unreadable file - skip */
        }
    }

    return false;
}

/**
 * Discovers @imqueue service repositories under the given path. If an explicit
 * list of service names is provided it is returned as-is (de-duplicated,
 * order-preserving) without scanning - matching the behaviour of the legacy
 * bash tools where `-s` bypasses discovery. Otherwise every immediate
 * sub-directory of `path` whose `src/` tree contains a service class is
 * returned, sorted by name for deterministic output.
 *
 * @param {string} path - directory containing service repositories
 * @param {string[]} [explicit] - explicit service names (bypasses scanning)
 * @return {string[]} - service directory names (relative to `path`)
 */
export function discoverServices(path: string, explicit?: string[]): string[] {
    if (explicit && explicit.length) {
        return [...new Set(explicit.map(s => s.trim()).filter(Boolean))];
    }

    if (!existsSync(path)) {
        return [];
    }

    const found: string[] = [];

    for (const entry of readdirSync(path, { withFileTypes: true })) {
        // resolve symlinks to directories too, hence statSync over dirent
        let isDir = entry.isDirectory();

        if (entry.isSymbolicLink()) {
            try {
                isDir = statSync(join(path, entry.name)).isDirectory();
            } catch {
                isDir = false;
            }
        }

        if (isDir && isServiceDir(join(path, entry.name))) {
            found.push(entry.name);
        }
    }

    return found.sort();
}
