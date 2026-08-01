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

/**
 * How one member of a group can be recognised in an existing service.
 *
 * Any of the three is enough. They exist because the four groups leave three
 * different kinds of trace: an addon shows up as a dependency, a CI provider as
 * the config file it reads, and a VCS host only in the git remote.
 */
interface ProbeMember {
    /** Catalog id, provider id — whatever the prompt for this group selects. */
    id: string;
    /**
     * A dependency in the service's package.json, or several.
     *
     * A list is how a renamed package stays detectable: every name the package
     * has shipped under counts as evidence. Without that, the rename of an addon
     * would make every service that has not migrated yet invisible to the probe,
     * and the group would report nothing detected — no error, just a
     * recommendation that steers a fleet off its own stack.
     */
    dep?: string | string[];
    /** A path inside the service, file or directory. */
    files?: string[];
    /** A substring of a remote URL in the service's .git/config. */
    remote?: string;
}

/**
 * A one-of-many choice the fleet can answer instead of the user.
 *
 * Add a probe and the corresponding prompt starts proposing; nothing else needs
 * to change. A choice that leaves no trace in an existing service cannot be
 * probed this way and belongs absent rather than half-supported.
 */
interface GroupProbe {
    /** Group id: a catalog group for `catalog` probes, else a name for the note. */
    group: string;
    /** Human name for the group, for the note. */
    label: string;
    /**
     * `catalog` members are catalog package ids and reach the packages prompt
     * through {@link fleetDefaults}; `setting` members are provider ids chosen by
     * their own prompt and must NOT be handed to the catalog, which would reject
     * them as unknown packages.
     */
    kind: 'catalog' | 'setting';
    members: ProbeMember[];
    /**
     * The member to propose when the fleet uses several, where the project
     * recommends one. It also decides whether a fleet on something else is told
     * that moving is worth considering.
     *
     * Without it a split fleet falls back to its own majority, which is the
     * honest answer where the project has no preference: one git host or CI
     * provider is not better than another, so those two probes leave it unset.
     */
    recommended?: string;
    /**
     * What to recommend when the fleet says nothing at all.
     *
     * The recommendation is DYNAMIC: a fleet that already runs on something is
     * its own recommendation, because matching it is what a new service joining
     * it should do. This is the edge case underneath — an empty fleet, or one
     * that uses nothing from this group — where the project's own preference is
     * the only thing left to go on.
     *
     * Configured settings do not appear in that chain because they never reach a
     * prompt: a `vcs.provider` or a `packages` list in the config is used
     * outright, so there is nothing left to recommend.
     */
    baseline: string;
}

const PROBES: GroupProbe[] = [
    {
        group: 'orm',
        label: 'ORM',
        kind: 'catalog',
        members: [
            {
                id: 'sequelize',
                dep: ['@imqueue/pg-sequelize', '@imqueue/sequelize'],
            },
            { id: 'pg-prisma', dep: '@imqueue/pg-prisma' },
        ],
        recommended: 'pg-prisma',
        baseline: 'pg-prisma',
    },
    {
        group: 'tracing',
        label: 'tracing',
        kind: 'catalog',
        members: [
            {
                id: 'opentelemetry',
                dep: [
                    '@imqueue/opentelemetry',
                    '@imqueue/opentelemetry-instrumentation-imqueue',
                ],
            },
            {
                id: 'dd-trace',
                dep: ['@imqueue/datadog', '@imqueue/dd-trace'],
            },
        ],
        recommended: 'opentelemetry',
        baseline: 'opentelemetry',
    },
    {
        group: 'vcs',
        label: 'VCS host',
        kind: 'setting',
        members: [
            { id: 'github', remote: 'github.com' },
            // Host rather than domain: GitLab and Bitbucket are both commonly
            // self-hosted, and `gitlab.example.com` is still GitLab. A host that
            // names none of them — GitHub Enterprise on a custom domain, say —
            // leaves no evidence, which is reported as no evidence.
            { id: 'gitlab', remote: 'gitlab' },
            { id: 'bitbucket', remote: 'bitbucket' },
        ],
        baseline: 'github',
    },
    {
        group: 'ci',
        label: 'CI provider',
        kind: 'setting',
        members: [
            { id: 'github-actions', files: ['.github/workflows'] },
            { id: 'circleci', files: ['.circleci/config.yml'] },
            { id: 'travis', files: ['.travis.yml', '.travis.yaml'] },
        ],
        baseline: 'github-actions',
    },
];

/** What the fleet says about one exclusive group. */
export interface GroupAnalysis {
    /** Member id to propose, or `null` when the fleet says nothing useful. */
    propose: string | null;
    /** Services using each member, by member id. */
    counts: Record<string, number>;
    /**
     * `scan` when the directories were read, `cache` when a previous scan
     * answered, `override` when the user's own contradicting choice did.
     */
    source: 'scan' | 'cache' | 'override';
}

/** What a fleet scan found. */
export interface FleetAnalysis {
    /** Services found in the fleet. */
    services: number;
    /** One entry per probed group, keyed by catalog group id. */
    groups: Record<string, GroupAnalysis>;
}

interface FleetRecord {
    /** Services using each member, keyed by group id then member id. */
    groups: Record<string, Record<string, number>>;
    services: number;
    /** Immediate subdirectory names at scan time — the staleness fingerprint. */
    dirs: string[];
    /** Member id the user picked against the scan, by group id. */
    overrides?: Record<string, string>;
    at: number;
}

interface FleetCache {
    version: number;
    fleets: Record<string, FleetRecord>;
}

// 2: per-group counts and overrides, where 1 held only the ORM. An older cache
// is discarded rather than migrated — it costs one scan to rebuild.
const CACHE_VERSION = 2;
// A fleet member is an @imqueue service, and every one of them depends on rpc.
// This is deliberately NOT lib/discoverServices(), which reads every .ts file
// under each candidate's src/ looking for a service class: these questions are
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
 * The remote URLs a service's git config names.
 *
 * @remarks
 * Read straight out of `.git/config` rather than by shelling out to git: this
 * runs once per service before a prompt, and a process per service is exactly
 * the cost the cache exists to avoid.
 *
 * @param {string} dir
 * @return {string}
 */
function gitRemotes(dir: string): string {
    try {
        return readFileSync(join(dir, '.git', 'config'), 'utf8');
    } catch {
        return '';
    }
}

/**
 * Whether one service shows evidence of a member.
 *
 * @param {string} dir - the service directory
 * @param {Set<string>} deps - its declared dependencies
 * @param {string} remotes - its .git/config contents
 * @param {ProbeMember} member
 * @return {boolean}
 */
function usesMember(
    dir: string,
    deps: Set<string>,
    remotes: string,
    member: ProbeMember,
): boolean {
    if (member.dep) {
        const names = Array.isArray(member.dep) ? member.dep : [member.dep];

        if (names.some(name => deps.has(name))) {
            return true;
        }
    }

    if (member.files?.some(file => existsSync(join(dir, file)))) {
        return true;
    }

    return !!member.remote && remotes.includes(member.remote);
}

/**
 * Counts, for every probed group, how many services use each of its members.
 *
 * @param {string} root - directory holding the service directories
 * @return {FleetRecord}
 */
function scan(root: string): FleetRecord {
    const dirs = subDirs(root);
    const groups: Record<string, Record<string, number>> = {};
    let services = 0;

    for (const probe of PROBES) {
        groups[probe.group] = Object.fromEntries(
            probe.members.map(m => [m.id, 0]),
        );
    }

    for (const dir of dirs) {
        const path = join(root, dir);
        const deps = dependenciesOf(path);

        if (!deps.has(RPC)) {
            continue;
        }

        services++;

        // Read once per service, not once per member: three of the four probes
        // want it and re-reading would make the scan four times the IO.
        const remotes = gitRemotes(path);

        for (const probe of PROBES) {
            for (const member of probe.members) {
                if (usesMember(path, deps, remotes, member)) {
                    groups[probe.group][member.id]++;
                }
            }
        }
    }

    return { groups, services, dirs, at: Date.now() };
}

/**
 * Decides what to propose for one group from its counts.
 *
 * @param {GroupProbe} probe
 * @param {Record<string, number>} counts
 * @return {string | null}
 */
function proposeFor(
    probe: GroupProbe,
    counts: Record<string, number>,
): string | null {
    const used = probe.members.filter(m => (counts[m.id] || 0) > 0);

    if (!used.length) {
        // Nothing in the fleet uses this group, and picking for the user here
        // would add a capability nobody asked for. `(none)` stays.
        return null;
    }

    if (used.length === 1) {
        return used[0].id;
    }

    if (probe.recommended) {
        return probe.recommended;
    }

    // No recommendation to fall back on, so follow the fleet: the member most
    // of it uses. A dead heat proposes nothing rather than breaking the tie on
    // catalog order, which would look like advice and be arbitrary.
    const [first, second] = [...used].sort(
        (a, b) => (counts[b.id] || 0) - (counts[a.id] || 0),
    );

    return counts[first.id] === counts[second.id] ? null : first.id;
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
 * Builds the public analysis from a record.
 *
 * @param {FleetRecord} record
 * @param {boolean} fromCache
 * @return {FleetAnalysis}
 */
function toAnalysis(record: FleetRecord, fromCache: boolean): FleetAnalysis {
    const groups: Record<string, GroupAnalysis> = {};

    for (const probe of PROBES) {
        const counts = record.groups[probe.group] || {};
        const override = record.overrides?.[probe.group];

        groups[probe.group] = {
            propose: override || proposeFor(probe, counts),
            counts,
            source: override ? 'override' : fromCache ? 'cache' : 'scan',
        };
    }

    return { services: record.services, groups };
}

/**
 * Works out what a fleet is built on, for every group the prompt can propose in.
 *
 * @remarks
 * Answers from the cache when it can. The cache is keyed by path and carries the
 * subdirectory names it was built from, so a fleet that has gained or lost a
 * directory is rescanned — one `readdir` to know, rather than a package.json per
 * service. A user's own contradicting choice, recorded by
 * {@link recordFleetChoices}, outranks both: they said it deliberately, and it
 * survives later rescans until a scan agrees with it.
 *
 * @param {string} root - directory holding the service directories
 * @return {FleetAnalysis}
 */
export function analyseFleet(root: string): FleetAnalysis {
    const abs = resolve(root);
    const cache = readCache();
    const cached = cache.fleets[abs];

    if (cached && sameDirs(cached.dirs, subDirs(abs))) {
        return toAnalysis(cached, true);
    }

    const fresh = scan(abs);

    // An override is intent, not measurement, so it outlives a rescan — but
    // once the fleet itself says what the user said, it has nothing left to
    // override and would only mask a later change.
    for (const [group, choice] of Object.entries(cached?.overrides || {})) {
        const probe = PROBES.find(p => p.group === group);

        if (probe && proposeFor(probe, fresh.groups[group] || {}) !== choice) {
            fresh.overrides = { ...fresh.overrides, [group]: choice };
        }
    }

    cache.fleets[abs] = fresh;
    writeCache(cache);

    return toAnalysis(fresh, false);
}

/**
 * The CATALOG ids to preselect.
 *
 * @remarks
 * Catalog groups only. A provider id like `github` would be rejected by
 * `validateSelection` as an unknown package, and rightly — it is not one.
 *
 * @param {FleetAnalysis} analysis
 * @return {string[]}
 */
export function fleetDefaults(analysis: FleetAnalysis): string[] {
    return PROBES.filter(probe => probe.kind === 'catalog')
        .map(probe => analysis.groups[probe.group]?.propose)
        .filter((id): id is string => !!id);
}

/**
 * What to mark as recommended for one group.
 *
 * @remarks
 * The fleet first: a fleet already running on something IS the recommendation,
 * because a new service joining it should match it. Only when the fleet says
 * nothing does the project's own preference apply — pg-prisma, opentelemetry,
 * github, github-actions.
 *
 * This is a LABEL, not the pre-selection. For the optional groups the cursor
 * still opens on `(none)` when the fleet is silent: a service that needs no
 * database is not a service that chose wrongly.
 *
 * @param {FleetAnalysis | null} analysis
 * @param {string} group
 * @return {string | null}
 */
export function recommendedFor(
    analysis: FleetAnalysis | null,
    group: string,
): string | null {
    const probe = PROBES.find(p => p.group === group);

    if (!probe) {
        return null;
    }

    return fleetProposal(analysis, group) || probe.baseline;
}

/**
 * What the fleet proposes for one group, or `null` when it says nothing.
 *
 * @remarks
 * For the choices with their own prompt — the VCS host and the CI provider —
 * where the caller supplies its own default to fall back on.
 *
 * @param {FleetAnalysis | null} analysis
 * @param {string} group
 * @return {string | null}
 */
export function fleetProposal(
    analysis: FleetAnalysis | null,
    group: string,
): string | null {
    return analysis?.groups[group]?.propose || null;
}

/**
 * One line per group explaining what was proposed and why, for the prompt.
 *
 * @remarks
 * Keyed by catalog group id, and a group the fleet says nothing about gets no
 * entry — silence is the right output when there is nothing to report.
 *
 * @param {FleetAnalysis} analysis
 * @return {Record<string, string>}
 */
export function fleetNotes(analysis: FleetAnalysis): Record<string, string> {
    const notes: Record<string, string> = {};

    for (const probe of PROBES) {
        const group = analysis.groups[probe.group];

        if (!group?.propose) {
            const used = probe.members.filter(
                m => (group?.counts[m.id] || 0) > 0,
            );

            // A dead heat is worth saying out loud: the fleet is genuinely
            // divided, and the user is the one to settle it.
            if (used.length > 1) {
                notes[probe.group] =
                    `This fleet is split evenly between ` +
                    `${used.map(m => m.id).join(' and ')} — your call.`;
            }

            continue;
        }

        const from =
            group.source === 'override'
                ? 'your earlier choice here'
                : `${analysis.services} service${
                      analysis.services === 1 ? '' : 's'
                  } in this fleet`;
        const split = probe.members.filter(m => (group.counts[m.id] || 0) > 0);
        let note: string;

        if (group.source !== 'override' && split.length > 1) {
            const detail = split
                .map(m => `${group.counts[m.id]} on ${m.id}`)
                .join(', ');

            note = probe.recommended
                ? `This fleet uses more than one ${probe.label} (${detail}); ` +
                  `preselected the recommended one.`
                : `This fleet uses more than one ${probe.label} (${detail}); ` +
                  `preselected the one most of it uses.`;
        } else {
            note = `Preselected ${group.propose} to match ${from}.`;
        }

        // Where the project recommends something else, say so — proposing what
        // the fleet uses is not the same as endorsing it forever.
        if (probe.recommended && group.propose !== probe.recommended) {
            note +=
                ` Moving the fleet to ${probe.recommended} is worth ` +
                'considering — as its own piece of work, not as part of this.';
        }

        notes[probe.group] = note;
    }

    return notes;
}

/**
 * The note for one group, ready to append to a prompt message, or `''`.
 *
 * @param {FleetAnalysis | null} analysis
 * @param {string} group
 * @return {string}
 */
export function fleetNote(
    analysis: FleetAnalysis | null,
    group: string,
): string {
    return analysis ? fleetNotes(analysis)[group] || '' : '';
}

/**
 * Records selections that contradict the scan, so the next run proposes what the
 * user actually wants.
 *
 * @remarks
 * Only a contradiction is written. Agreeing with the scan is not an instruction,
 * and storing it would make an override out of a shrug. Selecting nothing from a
 * group is not a contradiction either: it says the service does not need that
 * capability, not that the fleet is built differently.
 *
 * @param {string} root - directory holding the service directories
 * @param {string[]} selection - the resolved catalog ids
 */
export function recordFleetChoices(root: string, selection: string[]): void {
    const abs = resolve(root);
    const cache = readCache();
    const record = cache.fleets[abs];

    if (!record) {
        return;
    }

    let changed = false;

    for (const probe of PROBES) {
        const chosen = probe.members.find(m => selection.includes(m.id))?.id;

        if (!chosen) {
            continue;
        }

        const effective =
            record.overrides?.[probe.group] ||
            proposeFor(probe, record.groups[probe.group] || {});

        if (effective === chosen) {
            continue;
        }

        record.overrides = { ...record.overrides, [probe.group]: chosen };
        changed = true;
    }

    if (changed) {
        record.at = Date.now();
        cache.fleets[abs] = record;
        writeCache(cache);
    }
}
