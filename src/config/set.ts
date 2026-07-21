/*!
 * @imqueue/cli command: config set
 *
 * I'm Queue Software Project
 * Copyright (C) 2025  imqueue.com <support@imqueue.com>
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
import { styleText } from 'node:util';
import { type Arguments } from 'yargs';
import {
    type IMQCLIConfig,
    printError,
    loadConfig,
    saveConfig,
    prepareConfigValue,
    setPath,
    deriveStructured,
    applyStructured,
} from '../../lib/index.js';
import {
    vcsHosts,
    ciProviders,
    containerRegistries,
    registerBuiltinProviders,
} from '../providers/index.js';

/** Structured config sections whose writes are mirrored to legacy keys. */
const STRUCTURED = /^(vcs|ci|registry|packages|templatesRef)(\.|$)/;

/**
 * Legacy keys that map cleanly onto a structured dot-path. Setting one of them
 * mirrors the value into its structured counterpart before the sync, so the
 * structured view (which `deriveStructured` prefers) cannot silently shadow a
 * freshly-set legacy value and make the success message lie.
 */
const LEGACY_TO_STRUCTURED: Record<string, string> = {
    gitHubAuthToken: 'vcs.auth.token',
    gitRepoPrivate: 'vcs.private',
    dockerHubNamespace: 'registry.namespace',
    dockerHubUser: 'registry.auth.user',
    dockerHubPassword: 'registry.auth.password',
};

/** Structured provider keys validated against the registered provider ids. */
function validateProvider(option: string, value: unknown): void {
    const specs: Record<
        string,
        {
            registry: { has(id: string): boolean; ids(): string[] };
            label: string;
        }
    > = {
        'vcs.provider': { registry: vcsHosts, label: 'VCS host' },
        'ci.provider': { registry: ciProviders, label: 'CI provider' },
        'registry.provider': {
            registry: containerRegistries,
            label: 'container registry',
        },
    };

    const spec = specs[option];

    if (spec && typeof value === 'string' && !spec.registry.has(value)) {
        throw new Error(
            `Invalid ${spec.label} "${value}". ` +
                `Valid: ${spec.registry.ids().join(', ')}.`,
        );
    }

    // enum-valued structured key: git transport for the create-time push
    if (
        option === 'vcs.protocol' &&
        typeof value === 'string' &&
        value !== 'https' &&
        value !== 'ssh'
    ) {
        throw new Error(`Invalid git protocol "${value}". Valid: https, ssh.`);
    }
}

/**
 * Removes structured sections that ended up empty (e.g. an `auth: {}` left by
 * the sync) so the config stays tidy.
 *
 * @param {IMQCLIConfig} cfg
 */
function pruneEmpty(cfg: IMQCLIConfig): void {
    for (const key of ['vcs', 'ci', 'registry'] as const) {
        const section = (cfg as any)[key];

        if (!section || typeof section !== 'object') {
            continue;
        }

        if (section.auth && Object.keys(section.auth).length === 0) {
            delete section.auth;
        }

        if (Object.keys(section).length === 0) {
            delete (cfg as any)[key];
        }
    }
}

export const { command, describe, handler } = {
    command: 'set <option> <value>',
    describe:
        'Updates given config option with given value. Nested options may ' +
        'be addressed with a dot-path, e.g. "ci.provider".',

    handler(argv: Arguments) {
        try {
            registerBuiltinProviders();

            const config = loadConfig();
            const option = String((argv as any).option);
            let value = prepareConfigValue((argv as any).value);

            // reject an unknown provider id at set time (with the valid list)
            // rather than deferring the failure to `service create`
            validateProvider(option, value);

            // `packages` is an array; accept a convenient comma-separated list
            // (e.g. `config set packages opentelemetry,pg-cache`) as well as a
            // JSON array
            if (option === 'packages' && typeof value === 'string') {
                value = value
                    .split(/\s*,\s*/)
                    .filter((v: string) => v.length > 0);
            }

            // dot-path aware; a plain key (no dots) behaves as before
            setPath(config, option, value);

            // a legacy key that maps onto a structured path: mirror it into the
            // structured view so the two never diverge (the structured value
            // otherwise wins in deriveStructured and shadows this write)
            const mirrored = LEGACY_TO_STRUCTURED[option];

            if (mirrored) {
                setPath(config, mirrored, value);
            }

            // keep structured <-> legacy keys in sync when a structured (or
            // mirrored legacy) key is set, so a config written by v4 still
            // works if downgraded to v3
            if (STRUCTURED.test(option) || mirrored) {
                applyStructured(config, deriveStructured(config));
                pruneEmpty(config);
            }

            saveConfig(config);

            process.stdout.write(
                styleText('green', 'Option ') +
                    styleText('cyan', `${(argv as any).option}`) +
                    styleText('green', ' is set to ') +
                    styleText('cyan', `${(argv as any).value}`) +
                    '\n',
            );
        } catch (err) {
            printError(err as Error);
        }
    },
};
