/*!
 * @imqueue/cli library: config-schema
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

export const DEFAULT_TEMPLATES_REF = 'master';

export interface VcsConfig {
    provider?: string;
    namespace?: string;
    private?: boolean;
    auth?: { token?: string };
}

export interface CiConfig {
    provider?: string;
    auth?: { token?: string };
}

export interface RegistryConfig {
    provider?: string;
    namespace?: string;
    region?: string;
    project?: string;
    accountId?: string;
    auth?: { user?: string; password?: string };
}

/**
 * The structured (v4) view of the CLI configuration. Every field is derived
 * either from the new structured keys or, when absent, from the legacy keys,
 * so an old config produces an equivalent structured view.
 */
export interface StructuredConfig {
    vcs: VcsConfig;
    ci: CiConfig;
    registry: RegistryConfig;
    templatesRef?: string;
    packages: string[];
}

/**
 * Returns true when the given config carries any legacy key. Used to decide
 * whether to derive legacy CI behavior (travis) for old installations.
 *
 * @param {IMQCLIConfig} cfg
 * @return {boolean}
 */
function hasLegacyKeys(cfg: IMQCLIConfig): boolean {
    return [
        'gitBaseUrl',
        'gitHubAuthToken',
        'gitRepoPrivate',
        'useGit',
        'useDocker',
        'dockerHubNamespace',
        'dockerHubUser',
        'dockerHubPassword',
    ].some(key => typeof cfg[key] !== 'undefined');
}

/**
 * Returns true when the config carries any structured (v4) section. Used to
 * tell a genuine v3 config apart from a v4 config that merely mirrors legacy
 * keys: `applyStructured` writes `useGit`/`useDocker` alongside the structured
 * sections, and those mirrors must NOT be mistaken for a legacy install.
 *
 * @param {IMQCLIConfig} cfg
 * @return {boolean}
 */
function hasStructuredKeys(cfg: IMQCLIConfig): boolean {
    return (
        typeof cfg.vcs !== 'undefined' ||
        typeof cfg.ci !== 'undefined' ||
        typeof cfg.registry !== 'undefined' ||
        typeof cfg.packages !== 'undefined' ||
        typeof cfg.templatesRef !== 'undefined'
    );
}

/**
 * Derives the namespace from a legacy git base url such as
 * "git@github.com:imqueue" -> "imqueue".
 *
 * @param {string | undefined} gitBaseUrl
 * @return {string | undefined}
 */
function namespaceFromGitBaseUrl(
    gitBaseUrl: string | undefined,
): string | undefined {
    if (!gitBaseUrl) {
        return undefined;
    }

    return gitBaseUrl.split(':').pop() || undefined;
}

/**
 * Builds the structured (v4) view of a possibly-legacy config. New structured
 * keys always win; anything missing is derived from legacy keys so that an
 * old config behaves identically to before.
 *
 * @param {IMQCLIConfig} cfg - raw config as loaded from disk
 * @return {StructuredConfig}
 */
export function deriveStructured(cfg: IMQCLIConfig): StructuredConfig {
    const vcs: VcsConfig = { ...cfg.vcs };
    const ci: CiConfig = { ...cfg.ci };
    const registry: RegistryConfig = { ...cfg.registry };
    const legacy = hasLegacyKeys(cfg);

    // ——— VCS host ———
    if (vcs.provider === undefined && (cfg.gitBaseUrl || cfg.useGit)) {
        // legacy only ever integrated with github
        vcs.provider = 'github';
    }

    if (vcs.namespace === undefined) {
        vcs.namespace = namespaceFromGitBaseUrl(cfg.gitBaseUrl);
    }

    if (
        vcs.private === undefined &&
        typeof cfg.gitRepoPrivate !== 'undefined'
    ) {
        vcs.private = cfg.gitRepoPrivate;
    }

    vcs.auth = { ...vcs.auth };

    // the legacy gitHubAuthToken is github-specific: never reuse it as the
    // credential for an explicitly-selected gitlab/bitbucket host
    if (
        vcs.auth.token === undefined &&
        cfg.gitHubAuthToken &&
        vcs.provider !== 'gitlab' &&
        vcs.provider !== 'bitbucket'
    ) {
        vcs.auth.token = cfg.gitHubAuthToken;
    }

    // ——— CI ———
    // Infer legacy travis ONLY for a genuinely legacy (v3) config - one with
    // no structured sections at all. A v4 config carries structured keys plus
    // their mirrored legacy keys (useGit, ...); mistaking those mirrors for a
    // v3 install silently resurrected travis and broke gitlab/bitbucket creates.
    if (ci.provider === undefined && legacy && !hasStructuredKeys(cfg)) {
        ci.provider = 'travis';
    }

    // ——— container registry ———
    if (registry.provider === undefined) {
        if (cfg.useDocker) {
            registry.provider = 'dockerhub';
        }
    }

    if (registry.namespace === undefined && cfg.dockerHubNamespace) {
        registry.namespace = cfg.dockerHubNamespace;
    }

    registry.auth = { ...registry.auth };

    if (registry.auth.user === undefined && cfg.dockerHubUser) {
        registry.auth.user = cfg.dockerHubUser;
    }

    if (registry.auth.password === undefined && cfg.dockerHubPassword) {
        registry.auth.password = cfg.dockerHubPassword;
    }

    return {
        vcs,
        ci,
        registry,
        templatesRef: cfg.templatesRef,
        packages: Array.isArray(cfg.packages) ? cfg.packages : [],
    };
}

/**
 * Writes the structured config into a raw config object and keeps the mapped
 * legacy keys in sync, so a config written by v4 still works if the CLI is
 * later downgraded to v3. Mutates and returns the given raw config.
 *
 * @param {IMQCLIConfig} cfg - raw config to update (mutated)
 * @param {StructuredConfig} structured - structured values to persist
 * @return {IMQCLIConfig}
 */
export function applyStructured(
    cfg: IMQCLIConfig,
    structured: StructuredConfig,
): IMQCLIConfig {
    const { vcs, ci, registry } = structured;

    // structured sections
    cfg.vcs = { ...vcs, auth: { ...vcs.auth } };
    cfg.ci = { ...ci };
    cfg.registry = { ...registry, auth: { ...registry.auth } };

    if (structured.templatesRef !== undefined) {
        cfg.templatesRef = structured.templatesRef;
    }

    cfg.packages = [...structured.packages];

    // ——— legacy mirror (downgrade safety) ———
    if (vcs.provider === 'github') {
        cfg.useGit = true;

        if (vcs.namespace) {
            cfg.gitBaseUrl = `git@github.com:${vcs.namespace}`;
        }
    } else if (vcs.provider) {
        // non-github host: legacy v3 can't drive it, disable legacy git flow
        cfg.useGit = false;
    }

    // gitHubAuthToken is github-specific: only mirror a token for the github
    // host (a v3 downgrade would otherwise send a gitlab/bitbucket token to the
    // GitHub API), and clear any stale value when the token is cleared or the
    // host is switched away from github
    if (vcs.provider === 'github' && vcs.auth?.token) {
        cfg.gitHubAuthToken = vcs.auth.token;
    } else {
        delete cfg.gitHubAuthToken;
    }

    if (typeof vcs.private !== 'undefined') {
        cfg.gitRepoPrivate = vcs.private;
    }

    if (registry.provider === 'dockerhub') {
        cfg.useDocker = true;

        if (registry.namespace) {
            cfg.dockerHubNamespace = registry.namespace;
        }

        if (registry.auth?.user) {
            cfg.dockerHubUser = registry.auth.user;
        }

        if (registry.auth?.password) {
            cfg.dockerHubPassword = registry.auth.password;
        }
    } else if (registry.provider) {
        // a non-dockerhub registry can't be expressed in legacy keys
        cfg.useDocker = false;
    }

    return cfg;
}
