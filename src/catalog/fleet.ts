/*!
 * @imqueue/cli catalog: fleet analysis
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
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    statSync,
    writeFileSync,
} from 'fs';
import { join } from 'path';
import { VAR_HOME, resolve } from '../../lib/index.js';

/** The ORM a fleet is built on, as far as its services' dependencies show. */
export type FleetOrm = 'sequelize' | 'pg-prisma' | 'mixed' | 'none';

/** What a fleet scan found, and where the answer came from. */
export interface FleetAnalysis {
    /** The fleet's ORM: `none` when no service declares one. */
    orm: FleetOrm;
    /** Services depending on `@imqueue/sequelize`. */
    sequelize: number;
    /** Services depending on `@imqueue/pg-prisma`. */
    prisma: number;
    /** Services found in the fleet. */
    services: number;
    /**
     * `scan` when the directories were read, `cache` when a previous scan
     * answered, `override` when the user's own contradicting choice did.
     */
    source: 'scan' | 'cache' | 'override';
}

interface FleetRecord {
    orm: FleetOrm;
    sequelize: number;
    prisma: number;
    services: number;
    /** Immediate subdirectory names at scan time — the staleness fingerprint. */
    dirs: string[];
    /** The user's choice, when they picked against the scan. */
    override?: 'sequelize' | 'pg-prisma';
    at: number;
}

interface FleetCache {
    version: number;
    fleets: Record<string, FleetRecord>;
}

const CACHE_VERSION = 1;
const SEQUELIZE = '@imqueue/sequelize';
const PG_PRISMA = '@imqueue/pg-prisma';
// A fleet member is an @imqueue service, and every one of them depends on rpc.
// This is deliberately NOT lib/discoverServices(), which reads every .ts file
// under each candidate's src/ looking for a service class: the ORM question is
// answered by dependencies, and this runs before a prompt, so it has to be
// cheap. One package.json per subdirectory, no source parsing.
const RPC = '@imqueue/rpc';

/**
 * Path of the analysis cache. Under VAR_HOME, so IMQ_CLI_HOME relocates it
 * along with everything else the CLI writes — which is what lets tests use a
 * sandbox rather than the developer's real cache.
 *
 * @return {string}
 */
export function fleetCachePath(): string {
    return resolve(VAR_HOME, 'fleet.json');
}

/**
 * Reads the cache, treating any damage as an empty cache.
 *
 * @return {FleetCache}
 */
function readCache(): FleetCache {
    try {
        const raw = JSON.parse(readFileSync(fleetCachePath(), 'utf8'));

        if (raw && raw.version === CACHE_VERSION && raw.fleets) {
            return raw as FleetCache;
        }
    } catch {
        /* missing, unreadable or from an older shape - start over */
    }

    return { version: CACHE_VERSION, fleets: {} };
}

/**
 * Writes the cache, ignoring failure.
 *
 * @remarks
 * A cache that cannot be written is a slower next run, not a broken one, so a
 * read-only or full disk must not take `imq service create` down with it.
 *
 * @param {FleetCache} cache
 */
function writeCache(cache: FleetCache): void {
    try {
        mkdirSync(resolve(VAR_HOME), { recursive: true });
        writeFileSync(fleetCachePath(), JSON.stringify(cache, null, 2) + '\n');
    } catch {
        /* the analysis just runs again next time */
    }
}

/**
 * Immediate subdirectory names of a path, sorted.
 *
 * @param {string} root
 * @return {string[]}
 */
function subDirs(root: string): string[] {
    if (!existsSync(root)) {
        return [];
    }

    const dirs: string[] = [];

    for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
            continue;
        }

        let isDir = entry.isDirectory();

        if (entry.isSymbolicLink()) {
            try {
                isDir = statSync(join(root, entry.name)).isDirectory();
            } catch {
                isDir = false;
            }
        }

        if (isDir) {
            dirs.push(entry.name);
        }
    }

    return dirs.sort();
}

/**
 * Every dependency name a package.json declares, runtime and dev.
 *
 * @param {string} dir
 * @return {Set<string>}
 */
function dependenciesOf(dir: string): Set<string> {
    try {
        const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));

        return new Set([
            ...Object.keys(pkg.dependencies || {}),
            ...Object.keys(pkg.devDependencies || {}),
        ]);
    } catch {
        return new Set();
    }
}

/**
 * Classifies a fleet by reading each service's declared dependencies.
 *
 * @param {string} root - directory holding the service directories
 * @return {FleetRecord}
 */
function scan(root: string): FleetRecord {
    const dirs = subDirs(root);
    let sequelize = 0;
    let prisma = 0;
    let services = 0;

    for (const dir of dirs) {
        const deps = dependenciesOf(join(root, dir));

        if (!deps.has(RPC)) {
            continue;
        }

        services++;

        if (deps.has(SEQUELIZE)) {
            sequelize++;
        }

        if (deps.has(PG_PRISMA)) {
            prisma++;
        }
    }

    let orm: FleetOrm = 'none';

    if (sequelize && prisma) {
        orm = 'mixed';
    } else if (sequelize) {
        orm = 'sequelize';
    } else if (prisma) {
        orm = 'pg-prisma';
    }

    return { orm, sequelize, prisma, services, dirs, at: Date.now() };
}

/**
 * Works out what ORM the fleet a new service is joining is built on.
 *
 * @remarks
 * Answers from the cache when it can. The cache is keyed by path and carries the
 * subdirectory names it was built from, so a fleet that has gained or lost a
 * directory is rescanned — one `readdir` to know, rather than a package.json per
 * service. A user's own contradicting choice, recorded by
 * {@link recordOrmChoice}, outranks both: they said it deliberately, and it
 * survives later rescans until a scan agrees with it.
 *
 * @param {string} root - directory holding the service directories
 * @return {FleetAnalysis}
 */
export function analyseFleet(root: string): FleetAnalysis {
    const abs = resolve(root);
    const cache = readCache();
    const cached = cache.fleets[abs];
    const answer = (record: FleetRecord): FleetAnalysis => ({
        orm: record.override || record.orm,
        sequelize: record.sequelize,
        prisma: record.prisma,
        services: record.services,
        source: record.override
            ? 'override'
            : record === cached
              ? 'cache'
              : 'scan',
    });

    if (cached && sameDirs(cached.dirs, subDirs(abs))) {
        return answer(cached);
    }

    const fresh = scan(abs);

    // An override is intent, not measurement, so it outlives a rescan — but
    // once the fleet itself says what the user said, it has nothing left to
    // override and would only mask a later change.
    if (cached?.override && cached.override !== fresh.orm) {
        fresh.override = cached.override;
    }

    cache.fleets[abs] = fresh;
    writeCache(cache);

    return answer(fresh);
}

/**
 * Compares two directory listings.
 *
 * @param {string[]} a
 * @param {string[]} b
 * @return {boolean}
 */
function sameDirs(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((name, i) => name === b[i]);
}

/**
 * The ORM to preselect for a fleet, as catalog ids.
 *
 * @remarks
 * A Sequelize fleet preselects sequelize: a new service joining it belongs on
 * the stack its siblings already run. Anything else with a database preselects
 * pg-prisma. A fleet with no ORM at all preselects NOTHING — a service that
 * talks to no database needs none, and guessing one here would put a database
 * in front of someone who never asked for it.
 *
 * @param {FleetAnalysis} analysis
 * @return {string[]}
 */
export function fleetOrmDefaults(analysis: FleetAnalysis): string[] {
    switch (analysis.orm) {
        case 'sequelize':
            return ['sequelize'];
        case 'pg-prisma':
        case 'mixed':
            return ['pg-prisma'];
        default:
            return [];
    }
}

/**
 * One line explaining what the fleet is built on and what follows from it, or
 * nothing when the fleet says nothing.
 *
 * @param {FleetAnalysis} analysis
 * @return {string}
 */
export function fleetOrmNote(analysis: FleetAnalysis): string {
    const from =
        analysis.source === 'override'
            ? 'your earlier choice here'
            : `${analysis.services} service${
                  analysis.services === 1 ? '' : 's'
              } in this fleet`;

    switch (analysis.orm) {
        case 'sequelize':
            return (
                `Preselected sequelize to match ${from}. ` +
                'Moving the fleet to pg-prisma is worth considering — as its ' +
                'own piece of work, not as part of this.'
            );
        case 'mixed':
            return (
                `This fleet uses both ORMs (${analysis.sequelize} on ` +
                `sequelize, ${analysis.prisma} on pg-prisma); preselected the ` +
                'recommended one.'
            );
        case 'pg-prisma':
            return `Preselected pg-prisma to match ${from}.`;
        default:
            return '';
    }
}

/**
 * Records a selection that contradicts the scan, so the next run proposes what
 * the user actually wants.
 *
 * @remarks
 * Only a contradiction is written. Agreeing with the scan is not an instruction,
 * and storing it would make an override out of a shrug.
 *
 * @param {string} root - directory holding the service directories
 * @param {string[]} selection - the resolved catalog ids
 */
export function recordOrmChoice(root: string, selection: string[]): void {
    const chosen = selection.includes('sequelize')
        ? 'sequelize'
        : selection.includes('pg-prisma')
          ? 'pg-prisma'
          : null;

    if (!chosen) {
        // Picking no ORM says nothing about what the fleet is built on, so it
        // is not a contradiction of anything.
        return;
    }

    const abs = resolve(root);
    const cache = readCache();
    const record = cache.fleets[abs];

    if (!record) {
        return;
    }

    const effective = record.override || record.orm;

    if (effective === chosen) {
        return;
    }

    record.override = chosen;
    record.at = Date.now();
    cache.fleets[abs] = record;
    writeCache(cache);
}
