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
import {
    analyseFleet,
    fleetDefaults,
    fleetNotes,
    recommendedFor,
    recordFleetChoices,
} from './fleet.js';

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
 * @param {Record<string, string>} [notes] - extra line per group id, shown above
 *                                           its list; used to say why something
 *                                           is preselected
 * @param {Record<string, string>} [recommended] - member id per group id to mark
 *                                                 as recommended
 * @return {Promise<string[]>}
 */
export async function promptPackages(
    catalog: Catalog,
    defaults: string[],
    notes: Record<string, string> = {},
    recommended: Record<string, string> = {},
): Promise<string[]> {
    const chosen: string[] = [];

    for (const groupId of Object.keys(catalog.groups)) {
        const group = catalog.groups[groupId];
        const ids = packagesInGroup(catalog, groupId);

        if (!ids.length) {
            continue;
        }

        if (group.exclusive) {
            // The group's own guidance goes above the list, and each choice
            // carries its short hint. Without them the prompt showed bare
            // titles, so everything `imq service packages` explains about
            // choosing was missing at the one moment the choice is made.
            const answer = await inquirer.prompt<{ sel: string }>([
                {
                    type: 'list',
                    name: 'sel',
                    message:
                        `Select ${group.title}:` +
                        (group.pick ? `\n  ${group.pick}` : '') +
                        (notes[groupId] ? `\n  ${notes[groupId]}` : ''),
                    choices: [
                        { name: '(none)', value: '' },
                        // "(recommended)" is appended here rather than stored
                        // in the catalog because WHICH member is recommended
                        // depends on the fleet: in a Sequelize fleet, sequelize
                        // is the recommendation. Only the fallback is fixed.
                        // One suffix, never both: a title plus a hint plus the
                        // marker runs past 80 columns, and a wrapped row breaks
                        // an arrow-key list. Being recommended IS the case this
                        // option suits, so it supersedes the hint.
                        ...ids.map(id => ({
                            name:
                                (catalog.packages[id].title || id) +
                                (recommended[groupId] === id
                                    ? ' (recommended)'
                                    : catalog.packages[id].hint
                                      ? ` — ${catalog.packages[id].hint}`
                                      : ''),
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
 * When a fleet root is given, every exclusive group the fleet can answer for is
 * preselected from what its services already use — the ORM and the tracing
 * backend today. A group nothing in the fleet uses preselects nothing.
 *
 * That applies to the PROMPT only. A non-interactive run with no flag and no
 * configured packages still selects nothing: a proposal a user can decline is
 * one thing, and quietly adding a database dependency to an automated run is
 * another.
 *
 * @param {any} flag - raw --packages flag value
 * @param {string[] | undefined} service - per-service packages
 * @param {string[] | undefined} global - global-config packages
 * @param {Catalog} catalog
 * @param {boolean} interactive
 * @param {string} [fleetRoot] - directory holding the sibling services
 * @return {Promise<string[]>}
 */
export async function resolvePackages(
    flag: any,
    service: string[] | undefined,
    global: string[] | undefined,
    catalog: Catalog,
    interactive: boolean,
    fleetRoot?: string,
): Promise<string[]> {
    let selection = parsePackagesFlag(flag);
    // Only a choice made HERE — by flag or at the prompt — is worth remembering
    // against this path. Configured packages are already a standing decision,
    // and turning one into a per-fleet override would spread it silently.
    let deliberate = selection !== null;

    if (selection === null && Array.isArray(service)) {
        selection = service;
    }

    if (selection === null && Array.isArray(global)) {
        selection = global;
    }

    // Run whenever a fleet root is known, not only before a prompt: a run that
    // takes its ORM from --packages still needs the record to exist for
    // recordOrmChoice() to write an override against. A cache hit costs one
    // readdir.
    const analysis = fleetRoot ? analyseFleet(fleetRoot) : null;

    if (selection === null) {
        if (interactive) {
            const advice: Record<string, string> = {};

            for (const group of Object.keys(catalog.groups)) {
                const pick = recommendedFor(analysis, group);

                if (pick) {
                    advice[group] = pick;
                }
            }

            selection = await promptPackages(
                catalog,
                analysis ? fleetDefaults(analysis) : [],
                analysis ? fleetNotes(analysis) : {},
                advice,
            );
            deliberate = true;
        } else {
            selection = [];
        }
    }

    const validated = validateSelection(selection, catalog);

    if (fleetRoot && deliberate) {
        recordFleetChoices(fleetRoot, validated);
    }

    return validated;
}
