/*!
 * @imqueue/cli catalog: apply
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
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from '../../lib/index.js';
import type { FileFragment } from '../providers/types.js';
import type { Catalog } from './types.js';

/**
 * The combined effect of a package selection: token values to inject, extra
 * files to overlay, dependencies to merge, and guidance to print.
 */
export interface AddonResult {
    preload: string;
    config: string;
    files: FileFragment[];
    deps: Record<string, string>;
    devDeps: Record<string, string>;
    instructions: string[];
    env: string[];
    /** whether any selected addon contributes code snippets */
    hasSnippets: boolean;
}

/**
 * Aggregates the effects of a validated package selection. Pure - performs no
 * filesystem work.
 *
 * @param {string[]} selection - validated package ids
 * @param {Catalog} catalog
 * @return {AddonResult}
 */
export function resolveAddons(
    selection: string[],
    catalog: Catalog,
): AddonResult {
    const preloads: string[] = [];
    const configs: string[] = [];
    const files: FileFragment[] = [];
    const instructions: string[] = [];
    const env: string[] = [];
    const deps: Record<string, string> = {};
    const devDeps: Record<string, string> = {};

    for (const id of selection) {
        const entry = catalog.packages[id];

        if (!entry) {
            // the id passed plan-time validation against one catalog but is
            // absent from the one loaded here (e.g. bundled vs templates-repo);
            // skip it with a warning rather than crashing
            console.log(
                `Skipping unknown addon package "${id}" ` +
                    '(not found in the active catalog).',
            );

            continue;
        }

        Object.assign(deps, entry.deps || {});
        Object.assign(devDeps, entry.devDeps || {});

        if (entry.snippets?.preload) {
            preloads.push(entry.snippets.preload);
        }

        if (entry.snippets?.config) {
            configs.push(entry.snippets.config);
        }

        for (const [relPath, content] of Object.entries(entry.files || {})) {
            files.push({ relPath, content });
        }

        if (entry.instructions) {
            instructions.push(...entry.instructions);
        }

        if (entry.env) {
            env.push(...entry.env);
        }
    }

    return {
        preload: preloads.join('\n'),
        config: configs.join('\n'),
        files,
        deps,
        devDeps,
        instructions,
        env,
        hasSnippets: preloads.length > 0 || configs.length > 0,
    };
}

/**
 * Merges addon dependencies into a scaffolded service's package.json. The
 * package.json must already be valid JSON (tokens compiled).
 *
 * @param {string} servicePath
 * @param {Record<string, string>} deps
 * @param {Record<string, string>} devDeps
 */
export function mergeDependencies(
    servicePath: string,
    deps: Record<string, string>,
    devDeps: Record<string, string>,
): void {
    if (!Object.keys(deps).length && !Object.keys(devDeps).length) {
        return;
    }

    const pkgPath = resolve(servicePath, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, { encoding: 'utf8' }));

    pkg.dependencies = { ...pkg.dependencies, ...deps };
    pkg.devDependencies = { ...pkg.devDependencies, ...devDeps };

    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', {
        encoding: 'utf8',
    });
}
