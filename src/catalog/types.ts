/*!
 * @imqueue/cli catalog: types
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

/**
 * A group of catalog packages. Exclusive groups (e.g. tracing, orm) allow at
 * most one selected member; non-exclusive groups allow any number.
 */
export interface CatalogGroup {
    title: string;
    exclusive: boolean;
    /**
     * When the group applies at all, for the groups where picking nothing is a
     * normal answer rather than an omission.
     *
     * `exclusive` already means "at most one", and the prompt offers `(none)`
     * as its default — but a list of options with per-option guidance and no
     * word about skipping reads as a question you have to answer. A service
     * with no database wants no ORM; a service nobody traces wants no tracing.
     * Saying so is what stops a caller — an AI agent especially — picking one
     * because one appeared to be required.
     */
    pick?: string;
}

/**
 * A single installable addon. Effects are all optional so an entry can be a
 * pure dependency, a code-injecting addon, or anything in between.
 *
 * What belongs here is an INTEGRATED option: something the scaffolder wires into
 * the service. A bare dependency that a user could add with `npm i` and get the
 * same result does not need an entry, and having one makes a recommended list
 * read like a menu of equals — a bare `prisma` addon sat next to `pg-prisma`
 * for exactly that reason and was removed. Bespoke setups are what the
 * custom-templates mechanism is for; the catalog carries the recommended path.
 */
export interface CatalogEntry {
    /** group id this entry belongs to */
    group: string;
    /** human title (defaults to the entry id when absent) */
    title?: string;
    /**
     * When to pick this one over the others in its group.
     *
     * Exists for exclusive groups, where the title alone leaves a caller — an
     * AI agent especially — to guess between two entries that both sound
     * right. `imq service create` is by definition a NEW service, so a group
     * with a default should say so here rather than leave it implied.
     *
     * One sentence, imperative, and about the CHOICE rather than about setup:
     * anything to do after installing belongs in `instructions`.
     */
    pick?: string;
    /** runtime dependencies to merge into the service package.json */
    deps?: Record<string, string>;
    /** dev dependencies to merge into the service package.json */
    devDeps?: Record<string, string>;
    /**
     * code fragments keyed by addon token point, e.g.
     * { preload: "...", config: "..." } -> %ADDON_PRELOAD / %ADDON_CONFIG
     */
    snippets?: Record<string, string>;
    /** extra token-bearing files to drop into the service, by relative path */
    files?: Record<string, string>;
    /** documented environment variables this addon reads */
    env?: string[];
    /** post-create instructions to print */
    instructions?: string[];
}

/**
 * The full addon catalog, shipped as data in the templates repo so new
 * addons can be published without a CLI release.
 */
export interface Catalog {
    version: number;
    groups: Record<string, CatalogGroup>;
    packages: Record<string, CatalogEntry>;
}
