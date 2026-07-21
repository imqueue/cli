/*!
 * @imqueue/cli catalog: resolve
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
import inquirer, { type QuestionCollection } from 'inquirer';
import type { Catalog } from './types.js';

/**
 * Lists the catalog package ids that belong to a group, in catalog order.
 *
 * @param {Catalog} catalog
 * @param {string} groupId
 * @return {string[]}
 */
function packagesInGroup(catalog: Catalog, groupId: string): string[] {
    return Object.keys(catalog.packages).filter(
        id => catalog.packages[id].group === groupId,
    );
}

/**
 * Validates a package selection against the catalog: every id must be known,
 * duplicates are collapsed, and an exclusive group may hold at most one member.
 *
 * @param {string[]} selection
 * @param {Catalog} catalog
 * @return {string[]} - the validated, de-duplicated selection
 */
export function validateSelection(
    selection: string[],
    catalog: Catalog,
): string[] {
    const seen = new Set<string>();
    const chosenByGroup: Record<string, string> = {};
    const result: string[] = [];

    for (const id of selection) {
        const entry = catalog.packages[id];

        if (!entry) {
            throw new Error(
                `Unknown package "${id}". Available: ` +
                    `${Object.keys(catalog.packages).join(', ')}.`,
            );
        }

        if (seen.has(id)) {
            continue;
        }

        seen.add(id);

        const group = catalog.groups[entry.group];

        if (group?.exclusive) {
            if (chosenByGroup[entry.group]) {
                throw new Error(
                    `Only one "${group.title}" package is allowed, but both ` +
                        `"${chosenByGroup[entry.group]}" and "${id}" were selected.`,
                );
            }

            chosenByGroup[entry.group] = id;
        }

        result.push(id);
    }

    return result;
}

/**
 * Parses a --packages flag value into ids. Returns null when the flag was not
 * provided at all, and [] when explicitly negated (--no-packages).
 *
 * @param {any} flag
 * @return {string[] | null}
 */
export function parsePackagesFlag(flag: any): string[] | null {
    if (flag === false) {
        return []; // --no-packages
    }

    if (typeof flag === 'string' && flag.trim()) {
        return flag
            .split(/\s*,\s*/)
            .map(s => s.trim())
            .filter(Boolean);
    }

    if (Array.isArray(flag)) {
        return flag.map(String);
    }

    return null;
}

/**
 * Interactively prompts for package selection: a single-choice list per
 * exclusive group and a checkbox for each free group, pre-selected from the
 * given defaults.
 *
 * @param {Catalog} catalog
 * @param {string[]} defaults - ids to pre-select
 * @return {Promise<string[]>}
 */
export async function promptPackages(
    catalog: Catalog,
    defaults: string[],
): Promise<string[]> {
    const chosen: string[] = [];

    for (const groupId of Object.keys(catalog.groups)) {
        const group = catalog.groups[groupId];
        const ids = packagesInGroup(catalog, groupId);

        if (!ids.length) {
            continue;
        }

        if (group.exclusive) {
            const answer = await inquirer.prompt<{ sel: string }>([
                {
                    type: 'list',
                    name: 'sel',
                    message: `Select ${group.title}:`,
                    choices: [
                        { name: '(none)', value: '' },
                        ...ids.map(id => ({
                            name: catalog.packages[id].title || id,
                            value: id,
                        })),
                    ],
                    default: ids.find(id => defaults.includes(id)) || '',
                },
            ] as QuestionCollection);

            if (answer.sel) {
                chosen.push(answer.sel);
            }
        } else {
            const answer = await inquirer.prompt<{ sel: string[] }>([
                {
                    type: 'checkbox',
                    name: 'sel',
                    message: `Select ${group.title}:`,
                    choices: ids.map(id => ({
                        name: catalog.packages[id].title || id,
                        value: id,
                        checked: defaults.includes(id),
                    })),
                },
            ] as QuestionCollection);

            chosen.push(...answer.sel);
        }
    }

    return chosen;
}

/**
 * Resolves the final package selection using precedence:
 * flag (--packages/--no-packages) -> per-service -> global -> prompt -> none,
 * then validates it against the catalog.
 *
 * @param {any} flag - raw --packages flag value
 * @param {string[] | undefined} service - per-service packages
 * @param {string[] | undefined} global - global-config packages
 * @param {Catalog} catalog
 * @param {boolean} interactive
 * @return {Promise<string[]>}
 */
export async function resolvePackages(
    flag: any,
    service: string[] | undefined,
    global: string[] | undefined,
    catalog: Catalog,
    interactive: boolean,
): Promise<string[]> {
    let selection = parsePackagesFlag(flag);

    if (selection === null && Array.isArray(service)) {
        selection = service;
    }

    if (selection === null && Array.isArray(global)) {
        selection = global;
    }

    if (selection === null) {
        selection = interactive ? await promptPackages(catalog, []) : [];
    }

    return validateSelection(selection, catalog);
}
