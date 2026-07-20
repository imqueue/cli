/*!
 * IMQ-CLI library: resolve
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
import type { IMQCLIConfig } from './config.js';
import { getPath } from './config-path.js';

/**
 * Sources an option value can come from, in precedence order:
 * cli flags -> per-service config -> global config -> prompt -> default.
 */
export interface ResolveContext {
    /** parsed cli flags (e.g. yargs argv) */
    flags?: Record<string, any>;
    /** per-service config (.imqrc.json), wins over global */
    service?: IMQCLIConfig;
    /** global config (~/.imq/config.json) */
    global?: IMQCLIConfig;
    /** whether interactive prompting is allowed (TTY) */
    interactive?: boolean;
}

/**
 * Declarative description of how to resolve a single option.
 */
export interface OptionSpec<T> {
    /** human name, used in error messages */
    name: string;
    /** flag key(s) to read from ctx.flags */
    flag?: string | string[];
    /** dot-path to read from service and global config */
    path?: string;
    /** derive a value from legacy keys in the global config */
    fromLegacy?: (global: IMQCLIConfig) => T | undefined;
    /** interactive fallback, only used when ctx.interactive is true */
    prompt?: () => Promise<T>;
    /** default value used when nothing else yields a value */
    default?: T;
    /** when true, a missing final value throws instead of returning undefined */
    required?: boolean;
    /** optional validation applied to a non-undefined resolved value */
    validate?: (value: T) => boolean;
}

/**
 * Treats a flag value as "provided" when it is neither undefined nor an
 * empty string. yargs fills defaults, so callers should pass only the flags
 * they consider meaningful; empty strings are treated as not provided.
 *
 * @param {any} value
 * @return {boolean}
 */
function flagProvided(value: any): boolean {
    return value !== undefined && value !== '';
}

/**
 * Reads the first provided flag value from a spec's flag key(s).
 *
 * @param {OptionSpec<T>} spec
 * @param {Record<string, any> | undefined} flags
 * @return {T | undefined}
 */
function fromFlags<T>(
    spec: OptionSpec<T>,
    flags: Record<string, any> | undefined,
): T | undefined {
    if (!flags || spec.flag === undefined) {
        return undefined;
    }

    const keys = Array.isArray(spec.flag) ? spec.flag : [spec.flag];

    for (const key of keys) {
        if (flagProvided(flags[key])) {
            return flags[key] as T;
        }
    }

    return undefined;
}

/**
 * Resolves a single option value applying the precedence:
 * flag -> per-service config -> global config (structured then legacy) ->
 * prompt (interactive only) -> default.
 *
 * @param {OptionSpec<T>} spec - option description
 * @param {ResolveContext} ctx - available sources
 * @return {Promise<T | undefined>}
 */
export async function resolveOption<T>(
    spec: OptionSpec<T>,
    ctx: ResolveContext,
): Promise<T | undefined> {
    let value: T | undefined;

    // 1. cli flags
    value = fromFlags(spec, ctx.flags);

    // 2. per-service config
    if (value === undefined && spec.path && ctx.service) {
        value = getPath(ctx.service, spec.path) as T | undefined;
    }

    // 3. global config (structured path, then legacy derivation)
    if (value === undefined && ctx.global) {
        if (spec.path) {
            value = getPath(ctx.global, spec.path) as T | undefined;
        }

        if (value === undefined && spec.fromLegacy) {
            value = spec.fromLegacy(ctx.global);
        }
    }

    // 4. interactive prompt
    if (value === undefined && ctx.interactive && spec.prompt) {
        value = await spec.prompt();
    }

    // 5. default
    if (value === undefined) {
        value = spec.default;
    }

    if (value === undefined) {
        if (spec.required) {
            throw new Error(
                `Missing required option "${spec.name}". Provide it via a ` +
                    'flag or in your config.',
            );
        }

        return undefined;
    }

    if (spec.validate && !spec.validate(value)) {
        throw new TypeError(`Invalid value for option "${spec.name}".`);
    }

    return value;
}
