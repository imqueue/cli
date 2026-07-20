/*!
 * IMQ-CLI catalog: types
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
}

/**
 * A single installable addon. Effects are all optional so an entry can be a
 * pure dependency, a code-injecting addon, or anything in between.
 */
export interface CatalogEntry {
    /** group id this entry belongs to */
    group: string;
    /** human title (defaults to the entry id when absent) */
    title?: string;
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
