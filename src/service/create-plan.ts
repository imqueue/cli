/*!
 * IMQ-CLI command: service create - plan builder
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
import * as os from 'os';
import * as semver from 'semver';
import inquirer, { type QuestionCollection } from 'inquirer';
import {
    type IMQCLIConfig,
    type StructuredConfig,
    deriveStructured,
    dashed,
    camelCase,
    isEmail,
    isNamespace,
    isGithubToken,
    licensingOptions,
    toTravisTags,
    resolve,
} from '../../lib/index.js';
import type { CreateContext } from '../providers/types.js';
import { type ResolvedLicense, resolveLicense } from './create-scaffold.js';
import { loadCatalog } from '../catalog/load.js';
import { resolvePackages } from '../catalog/resolve.js';
import {
    ciProviders,
    containerRegistries,
    registerBuiltinProviders,
    vcsHosts,
} from '../providers/index.js';

const DEFAULT_CI = 'github-actions';
const DEFAULT_VCS = 'github';
const DEFAULT_REGISTRY = 'dockerhub';

export const DEFAULT_SERVICE_VERSION = '1.0.0-0';

/**
 * The fully-resolved, immutable plan for a single `service create` run. It
 * satisfies CreateContext (so providers can consume it) plus the scaffolding
 * inputs the pipeline needs.
 */
export interface CreatePlan extends CreateContext {
    template: string;
    license: ResolvedLicense;
    homepage: string;
    bugs: string;
    noInstall: boolean;
    /** whether repository creation + commit/push should run */
    useVcs: boolean;
}

export interface PlanSources {
    global: IMQCLIConfig;
    service: IMQCLIConfig;
    interactive: boolean;
    dryRun: boolean;
}

function ensureName(name: string): string {
    if (!name.trim()) {
        throw new TypeError('Service name expected, but was not given!');
    }

    return dashed(name.trim());
}

function ensureVersion(version: string): string {
    if (!version.trim()) {
        version = DEFAULT_SERVICE_VERSION;
    }

    if (!semver.valid(version)) {
        throw new TypeError(
            'Given version is invalid, please, provide valid semver format!',
        );
    }

    return version;
}

async function resolveAuthor(
    argv: any,
    global: IMQCLIConfig,
    service: IMQCLIConfig,
    interactive: boolean,
): Promise<string> {
    let name = (argv.author || service.author || global.author || '').trim();

    if (!name && interactive) {
        const answer = await inquirer.prompt<{ authorName: string }>([
            {
                type: 'input',
                name: 'authorName',
                message: "Enter author's name:",
                default: os.userInfo().username,
            },
        ] as QuestionCollection);

        name = answer.authorName.trim();
    }

    return name || os.userInfo().username;
}

async function resolveEmail(
    argv: any,
    global: IMQCLIConfig,
    service: IMQCLIConfig,
    interactive: boolean,
): Promise<string> {
    let email = (argv.email || service.email || global.email || '').trim();

    if (!isEmail(email) && interactive) {
        const answer = await inquirer.prompt<{ email: string }>([
            {
                type: 'input',
                name: 'email',
                message: "Enter author's email:",
            },
        ] as QuestionCollection);

        email = (answer.email || '').trim();
    }

    if (!isEmail(email)) {
        throw new TypeError("Author's email is required, but was not given!");
    }

    return email;
}

async function resolveLicenseId(
    argv: any,
    global: IMQCLIConfig,
    service: IMQCLIConfig,
    interactive: boolean,
): Promise<string> {
    // flag -> per-service -> global; prompt only when nothing was chosen
    const chosen = argv.license || service.license || global.license;

    if (!chosen && interactive) {
        return (await licensingOptions()).id;
    }

    return chosen || 'UNLICENSED';
}

async function resolveNodeTags(
    argv: any,
    interactive: boolean,
): Promise<string[]> {
    if (argv.n instanceof Array && argv.n.length) {
        return toTravisTags(argv.n);
    }

    let tags = String(argv.n || '')
        .split(/\s+|\s*,\s*/)
        .filter(Boolean);

    if (!tags.length && interactive) {
        const answer = await inquirer.prompt<{ tags: string }>([
            {
                type: 'input',
                name: 'tags',
                message:
                    'Enter node version(s) for CI builds (comma-separated ' +
                    'if multiple):',
                default: 'stable, latest',
            },
        ] as QuestionCollection);

        tags = answer.tags
            ? answer.tags.split(/\s+|\s*,\s*/).filter(Boolean)
            : [];
    }

    if (!tags.length) {
        tags = ['stable', 'latest'];
    }

    return toTravisTags(tags);
}

/**
 * Resolves the VCS section (namespace/token/private) when git integration is
 * enabled, prompting only interactively; throws with a clear message when a
 * required value is missing non-interactively.
 */
async function resolveVcsProvider(
    argv: any,
    structured: StructuredConfig,
    interactive: boolean,
): Promise<string> {
    registerBuiltinProviders();

    let id = (argv.vcs || '').trim() || structured.vcs.provider || '';

    if (!id) {
        if (interactive) {
            const answer = await inquirer.prompt<{ vcs: string }>([
                {
                    type: 'list',
                    name: 'vcs',
                    message: 'Select VCS host:',
                    choices: vcsHosts
                        .list()
                        .map(p => ({ name: p.title, value: p.id })),
                    default: DEFAULT_VCS,
                },
            ] as QuestionCollection);

            id = answer.vcs;
        } else {
            id = DEFAULT_VCS;
        }
    }

    if (!vcsHosts.has(id)) {
        throw new Error(
            `Unknown VCS host "${id}". Available: ${vcsHosts.ids().join(', ')}.`,
        );
    }

    return id;
}

async function resolveVcs(
    argv: any,
    structured: StructuredConfig,
    providerId: string,
    interactive: boolean,
    dryRun: boolean,
): Promise<{ namespace: string; token: string; private: boolean }> {
    const title = vcsHosts.get(providerId).title;
    // placeholder shown in a dry-run plan when a credential is not yet supplied
    // - a dry run makes no calls, so it must never demand a real value
    const PENDING = '<prompted at create>';

    let namespace = (argv.u || structured.vcs.namespace || '').trim();

    if (!isNamespace(namespace, providerId)) {
        if (!interactive) {
            if (dryRun) {
                namespace = namespace || PENDING;
            } else if (namespace) {
                throw new TypeError(
                    `${title} namespace "${namespace}" is invalid.`,
                );
            } else {
                throw new TypeError(
                    `${title} namespace required. Pass -u/--vcs-namespace ` +
                        '<name>, set vcs.namespace in config (imq config set ' +
                        'vcs.namespace <name>), or run interactively.',
                );
            }
        } else {
            const answer = await inquirer.prompt<{ ns: string }>([
                {
                    type: 'input',
                    name: 'ns',
                    message: `Enter ${title} namespace (user, org or workspace):`,
                },
            ] as QuestionCollection);

            if (!isNamespace(answer.ns.trim(), providerId)) {
                throw new TypeError(
                    `${title} namespace "${answer.ns.trim()}" is invalid.`,
                );
            }

            namespace = answer.ns.trim();
        }
    }

    let token = (argv.T || structured.vcs.auth?.token || '').trim();

    if (!isGithubToken(token)) {
        if (!interactive) {
            if (dryRun) {
                token = token || PENDING;
            } else {
                throw new Error(
                    `${title} auth token required. Pass -T/--vcs-token ` +
                        '<token>, set vcs.auth.token in config (imq config set ' +
                        'vcs.auth.token <token>), or run interactively.',
                );
            }
        } else {
            const answer = await inquirer.prompt<{ token: string }>([
                {
                    // masked: a token must never be echoed to the terminal
                    type: 'password',
                    mask: '*',
                    name: 'token',
                    message: `Enter your ${title} auth token:`,
                },
            ] as QuestionCollection);

            if (!isGithubToken(answer.token.trim())) {
                throw new Error(`Given ${title} auth token is invalid.`);
            }

            token = answer.token.trim();
        }
    }

    let isPrivate = argv.p ?? structured.vcs.private;

    if (typeof isPrivate === 'undefined') {
        if (interactive) {
            const answer = await inquirer.prompt<{ isPrivate: boolean }>([
                {
                    type: 'confirm',
                    name: 'isPrivate',
                    message: `Should the ${title} repository be private?`,
                    default: true,
                },
            ] as QuestionCollection);

            isPrivate = answer.isPrivate;
        } else {
            isPrivate = true;
        }
    }

    return { namespace, token, private: !!isPrivate };
}

/**
 * Resolves the CI provider, filtered by the chosen VCS host. Prefers an
 * explicit flag/config value, prompts interactively among compatible CIs, and
 * otherwise defaults to GitHub Actions (falling back to any compatible one).
 */
async function resolveCi(
    argv: any,
    structured: StructuredConfig,
    vcsProvider: string,
    interactive: boolean,
): Promise<string> {
    registerBuiltinProviders();

    const compatible = (id: string): boolean => {
        const p = ciProviders.tryGet(id);

        return (
            !!p &&
            (!p.supportedVcs.length ||
                !vcsProvider ||
                p.supportedVcs.includes(vcsProvider))
        );
    };

    let ci = (argv.ci || '').trim() || structured.ci.provider || '';

    if (!ci) {
        const choices = ciProviders
            .list()
            .filter(p => compatible(p.id))
            .map(p => ({ name: p.title, value: p.id }));

        if (interactive && choices.length) {
            const answer = await inquirer.prompt<{ ci: string }>([
                {
                    type: 'list',
                    name: 'ci',
                    message: 'Select CI provider:',
                    choices,
                    default:
                        choices.find(c => c.value === DEFAULT_CI)?.value ||
                        choices[0]?.value,
                },
            ] as QuestionCollection);

            ci = answer.ci;
        } else {
            ci = compatible(DEFAULT_CI)
                ? DEFAULT_CI
                : ciProviders.list().find(p => compatible(p.id))?.id ||
                  DEFAULT_CI;
        }
    }

    const provider = ciProviders.tryGet(ci);

    if (!provider) {
        throw new Error(
            `Unknown CI provider "${ci}". Available: ` +
                `${ciProviders.ids().join(', ')}.`,
        );
    }

    if (
        vcsProvider &&
        provider.supportedVcs.length &&
        !provider.supportedVcs.includes(vcsProvider)
    ) {
        throw new Error(
            `CI "${ci}" does not support the "${vcsProvider}" host.`,
        );
    }

    return ci;
}

/**
 * Resolves whether git integration should run, honoring the documented
 * flag -> .imqrc -> global precedence. Flags win first; then an explicit
 * per-source signal (`useGit`, or a configured vcs provider) is honored,
 * including an explicit `false` opt-out; only when nothing is configured is
 * the choice prompted (TTY) or defaulted to off.
 *
 * @param {any} argv - parsed cli arguments
 * @param {boolean | undefined} serviceUseGit - service (.imqrc) signal
 * @param {boolean | undefined} globalUseGit - global config signal
 * @param {boolean} interactive
 * @return {Promise<boolean>}
 */
async function resolveUseVcs(
    argv: any,
    serviceUseGit: boolean | undefined,
    globalUseGit: boolean | undefined,
    interactive: boolean,
): Promise<boolean> {
    // explicit flags win over any configured value
    if (argv.g === false) {
        return false; // --no-use-git
    }

    if (argv.g === true || !!(argv.vcs && String(argv.vcs).trim())) {
        return true; // --use-git or an explicit --vcs host
    }

    // then the configured signal, service (.imqrc) over global - an explicit
    // stored `false` is honored here (it is not nullish, so it is returned)
    if (serviceUseGit !== undefined) {
        return serviceUseGit;
    }

    if (globalUseGit !== undefined) {
        return globalUseGit;
    }

    // nothing configured: prompt when interactive, otherwise default to off
    if (!interactive) {
        return false;
    }

    const answer = await inquirer.prompt<{ useGit: boolean }>([
        {
            type: 'confirm',
            name: 'useGit',
            message:
                'Would you like to enable automatic repository creation ' +
                'for this service?',
            default: true,
        },
    ] as QuestionCollection);

    return !!answer.useGit;
}

interface ResolvedRegistry {
    want: boolean;
    provider: string;
    namespace: string;
    region: string;
    project: string;
    accountId: string;
    user: string;
    password: string;
}

const EMPTY_REGISTRY: ResolvedRegistry = {
    want: false,
    provider: '',
    namespace: '',
    region: '',
    project: '',
    accountId: '',
    user: '',
    password: '',
};

/**
 * Resolves the container registry section when dockerization is requested:
 * the registry provider, its declared config options, and (for docker hub)
 * credentials. If a required option can't be resolved, dockerization is
 * skipped (non-fatal) rather than failing the whole run.
 */
async function resolveRegistry(
    argv: any,
    structured: StructuredConfig,
    serviceUseDocker: boolean | undefined,
    globalUseDocker: boolean | undefined,
    interactive: boolean,
): Promise<ResolvedRegistry> {
    // flag -> .imqrc -> global precedence for the docker master switch: an
    // explicit --no-dockerize (argv.D === false) wins; then the service signal
    // (useDocker, or a configured registry provider) over the global signal, so
    // a service that requests a registry is dockerized even when the global
    // default is off. `false` short-circuits `??` so an opt-out is preserved.
    let want = argv.D ?? serviceUseDocker ?? globalUseDocker;

    if (want === undefined && interactive) {
        const answer = await inquirer.prompt<{ useDocker: boolean }>([
            {
                type: 'confirm',
                name: 'useDocker',
                message: 'Would you like to dockerize your service?',
                default: true,
            },
        ] as QuestionCollection);

        want = answer.useDocker;
    }

    if (!want) {
        return EMPTY_REGISTRY;
    }

    registerBuiltinProviders();

    let providerId =
        (argv.registry || '').trim() || structured.registry.provider || '';

    if (!providerId) {
        if (interactive) {
            const answer = await inquirer.prompt<{ registry: string }>([
                {
                    type: 'list',
                    name: 'registry',
                    message: 'Select container registry:',
                    choices: containerRegistries
                        .list()
                        .map(p => ({ name: p.title, value: p.id })),
                    default: DEFAULT_REGISTRY,
                },
            ] as QuestionCollection);

            providerId = answer.registry;
        } else {
            providerId = DEFAULT_REGISTRY;
        }
    }

    if (!containerRegistries.has(providerId)) {
        throw new Error(
            `Unknown registry "${providerId}". Available: ` +
                `${containerRegistries.ids().join(', ')}.`,
        );
    }

    const provider = containerRegistries.get(providerId);
    const flagMap: Record<string, any> = {
        namespace: argv.N,
        region: argv.region,
        project: argv.project,
        accountId: argv.accountId,
    };
    const values: Record<string, string> = {
        namespace: '',
        region: '',
        project: '',
        accountId: '',
    };

    for (const opt of provider.options || []) {
        let value = String(
            flagMap[opt.key] ?? (structured.registry as any)[opt.key] ?? '',
        ).trim();

        if (!value && interactive) {
            const answer = await inquirer.prompt<{ v: string }>([
                { type: 'input', name: 'v', message: `${opt.describe}:` },
            ] as QuestionCollection);

            value = answer.v.trim();
        }

        values[opt.key] = value;
    }

    const missing = (provider.options || []).filter(
        o => o.required && !values[o.key],
    );

    if (missing.length) {
        // non-fatal: skip dockerization when a required field is unavailable
        console.log(
            `Skipping dockerization: ${provider.title} needs ` +
                `${missing.map(m => m.describe).join(', ')}.`,
        );

        return EMPTY_REGISTRY;
    }

    let user = '';
    let password = '';

    // only docker hub uses username/password auth provisioned by the cli;
    // cloud registries read their secrets from the environment / CI
    if (providerId === 'dockerhub') {
        user = structured.registry.auth?.user || '';
        password = structured.registry.auth?.password || '';

        if (!user && interactive) {
            const answer = await inquirer.prompt<{ u: string }>([
                { type: 'input', name: 'u', message: 'Docker hub user:' },
            ] as QuestionCollection);

            user = answer.u.trim();
        }

        if (!password && interactive) {
            const answer = await inquirer.prompt<{ p: string }>([
                {
                    type: 'password',
                    name: 'p',
                    message: 'Docker hub password:',
                },
            ] as QuestionCollection);

            password = answer.p.trim();
        }
    }

    return {
        want: true,
        provider: providerId,
        namespace: values.namespace,
        region: values.region,
        project: values.project,
        accountId: values.accountId,
        user,
        password,
    };
}

/**
 * Builds the fully-resolved, immutable create plan from cli args and config
 * sources. Prompts are only issued when interactive; missing required values
 * fail with a clear message otherwise.
 *
 * @param {any} argv - parsed cli arguments
 * @param {PlanSources} sources - config sources and mode flags
 * @return {Promise<CreatePlan>}
 */
/**
 * Deep-merges the per-service config over the global config for the structured
 * sections (vcs/ci/registry incl. their nested `auth`), so a partial
 * `.imqrc.json` (e.g. `{ "vcs": { "private": false } }`) overrides only the
 * keys it names rather than replacing the whole section. Top-level scalars and
 * arrays keep replace-wins semantics (service wins).
 *
 * @param {IMQCLIConfig} global
 * @param {IMQCLIConfig} service
 * @return {IMQCLIConfig}
 */
function mergeConfig(
    global: IMQCLIConfig,
    service: IMQCLIConfig,
): IMQCLIConfig {
    const merged: IMQCLIConfig = { ...global, ...service };

    for (const key of ['vcs', 'ci', 'registry'] as const) {
        const g = (global as any)[key];
        const s = (service as any)[key];

        if (g || s) {
            (merged as any)[key] = {
                ...g,
                ...s,
                auth: { ...g?.auth, ...s?.auth },
            };
        }
    }

    return merged;
}

export async function buildCreatePlan(
    argv: any,
    sources: PlanSources,
): Promise<CreatePlan> {
    const { global, service, interactive, dryRun } = sources;
    const merged = mergeConfig(global, service);
    const structured = deriveStructured(merged);

    // Per-source structured views so the git/docker master switches honor the
    // documented flag -> .imqrc -> global precedence: a provider configured (or
    // useGit/useDocker set) in the service's .imqrc must outrank a global
    // scalar, which the merged view alone cannot express (a scalar unset in the
    // .imqrc keeps the global value). `false` short-circuits `??` so an
    // explicit opt-out is preserved.
    const serviceStruct = deriveStructured(service);
    const globalStruct = deriveStructured(global);
    const serviceUseGit =
        service.useGit ?? (serviceStruct.vcs.provider ? true : undefined);
    const globalUseGit =
        global.useGit ?? (globalStruct.vcs.provider ? true : undefined);
    const serviceUseDocker =
        service.useDocker ??
        (serviceStruct.registry.provider ? true : undefined);
    const globalUseDocker =
        global.useDocker ?? (globalStruct.registry.provider ? true : undefined);

    // The host the configured namespace/token belong to: the structured
    // provider, or github when only the legacy github token is present.
    const configuredVcsProvider =
        structured.vcs.provider ||
        (merged.gitHubAuthToken && !merged.vcs?.auth?.token
            ? 'github'
            : undefined);

    const name = ensureName(argv.name);
    const className = camelCase(name);
    const version = ensureVersion(argv.serviceVersion ?? argv.V ?? '');
    const description =
        (argv.description || '').trim() || `${name} - IMQ based service`;
    const author = await resolveAuthor(argv, global, service, interactive);
    const email = await resolveEmail(argv, global, service, interactive);
    const homepage = (argv.H || '').trim();
    const bugs = (argv.B || '').trim();

    const useVcs = await resolveUseVcs(
        argv,
        serviceUseGit,
        globalUseGit,
        interactive,
    );

    const vcsConfig = { provider: '', namespace: '', private: true };
    let token = '';

    if (useVcs) {
        const providerId = await resolveVcsProvider(
            argv,
            structured,
            interactive,
        );

        // A namespace/token stored in config belong to the host they were
        // configured for. If a DIFFERENT vcs host is now chosen (e.g. via
        // --vcs), never reuse them for the new host - that would leak a token
        // cross-host and push to the wrong namespace. Explicit -u/-T on the CLI
        // are host-agnostic overrides and are kept.
        if (configuredVcsProvider && providerId !== configuredVcsProvider) {
            structured.vcs = {
                ...structured.vcs,
                namespace: argv.u ? structured.vcs.namespace : undefined,
                auth: {
                    ...structured.vcs.auth,
                    token: argv.T ? structured.vcs.auth?.token : undefined,
                },
            };
        }

        const vcs = await resolveVcs(
            argv,
            structured,
            providerId,
            interactive,
            !!dryRun,
        );

        vcsConfig.provider = providerId;
        vcsConfig.namespace = vcs.namespace;
        vcsConfig.private = vcs.private;
        token = vcs.token;
    }

    // dockerization depends on a pushed repo; disable when git is off
    const registry = useVcs
        ? await resolveRegistry(
              argv,
              structured,
              serviceUseDocker,
              globalUseDocker,
              interactive,
          )
        : EMPTY_REGISTRY;

    const dockerize = registry.want;
    // don't prompt for a CI provider when git integration is off - a CI has no
    // repository to run against; silently take the default instead
    const ciProvider = await resolveCi(
        argv,
        structured,
        vcsConfig.provider,
        interactive && useVcs,
    );

    // travis only knows how to push to Docker Hub (it hardcodes the dockerhub
    // login/env); fail fast rather than generate a broken .travis.yml for a
    // cloud registry
    if (
        ciProvider === 'travis' &&
        dockerize &&
        registry.provider &&
        registry.provider !== 'dockerhub'
    ) {
        throw new Error(
            `Travis CI supports the dockerhub registry only, not ` +
                `"${registry.provider}". Choose --ci github-actions or ` +
                '--ci circleci for cloud registries, or --registry dockerhub.',
        );
    }
    const nodeTags = await resolveNodeTags(argv, interactive);
    const packages = await resolvePackages(
        argv.packages,
        Array.isArray(service.packages) ? service.packages : undefined,
        Array.isArray(global.packages) ? global.packages : undefined,
        loadCatalog(),
        interactive,
    );
    const license = resolveLicense(
        await resolveLicenseId(argv, global, service, interactive),
        author,
        email,
        homepage,
        name,
    );

    const config: StructuredConfig = {
        vcs: {
            provider: vcsConfig.provider || undefined,
            namespace: vcsConfig.namespace || undefined,
            private: vcsConfig.private,
            auth: { token: token || undefined },
        },
        ci: { provider: ciProvider, auth: structured.ci.auth },
        registry: {
            provider: dockerize ? registry.provider : undefined,
            namespace: registry.namespace || undefined,
            region: registry.region || undefined,
            project: registry.project || undefined,
            accountId: registry.accountId || undefined,
            auth: { user: registry.user, password: registry.password },
        },
        templatesRef: structured.templatesRef,
        packages,
    };

    return {
        path: resolve(argv.path),
        name,
        className,
        version,
        description,
        author,
        email,
        homepage,
        bugs,
        dockerize,
        nodeTags,
        nodeDockerTag: (argv.L || '').trim() || undefined,
        template:
            argv.template || service.template || global.template || 'default',
        license,
        // `install` is declared with default true; `--no-install` sets it false
        noInstall: argv.install === false,
        useVcs,
        config,
        interactive,
        dryRun,
    };
}
