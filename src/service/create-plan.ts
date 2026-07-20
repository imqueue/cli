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
    registerBuiltinProviders,
    vcsHosts,
} from '../providers/index.js';

const DEFAULT_CI = 'github-actions';
const DEFAULT_VCS = 'github';

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
    interactive: boolean,
): Promise<string> {
    let licenseId = argv.license || 'UNLICENSED';

    // prompt for a license only when the user hasn't chosen one anywhere
    if (
        licenseId === 'UNLICENSED' &&
        typeof global.license === 'undefined' &&
        interactive
    ) {
        licenseId = (await licensingOptions()).id;
    }

    return licenseId;
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
): Promise<{ namespace: string; token: string; private: boolean }> {
    const title = vcsHosts.get(providerId).title;
    let namespace = (argv.u || structured.vcs.namespace || '').trim();

    if (!isNamespace(namespace)) {
        if (!interactive) {
            throw new TypeError(
                `${title} namespace required, but was not given!`,
            );
        }

        const answer = await inquirer.prompt<{ ns: string }>([
            {
                type: 'input',
                name: 'ns',
                message: `Enter ${title} namespace (user, org or workspace):`,
            },
        ] as QuestionCollection);

        if (!isNamespace(answer.ns)) {
            throw new TypeError(`Given ${title} namespace is invalid!`);
        }

        namespace = answer.ns;
    }

    let token = (argv.T || structured.vcs.auth?.token || '').trim();

    if (!isGithubToken(token)) {
        if (!interactive) {
            throw new Error(`${title} auth token required, but was not given!`);
        }

        const answer = await inquirer.prompt<{ token: string }>([
            {
                type: 'input',
                name: 'token',
                message: `Enter your ${title} auth token:`,
            },
        ] as QuestionCollection);

        if (!isGithubToken(answer.token.trim())) {
            throw new Error(`Given ${title} auth token is invalid!`);
        }

        token = answer.token.trim();
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
 * Resolves whether git integration should run, prompting interactively when
 * the choice is not already made. Honors an explicit stored `false`.
 */
async function resolveUseVcs(
    argv: any,
    global: IMQCLIConfig,
    interactive: boolean,
): Promise<boolean> {
    // an explicit --vcs choice implies git integration
    let useGit =
        argv.g || !!(argv.vcs && String(argv.vcs).trim()) || global.useGit;

    if (!useGit && typeof global.useGit === 'undefined') {
        if (!interactive) {
            return false;
        }

        const answer = await inquirer.prompt<{ useGit: boolean }>([
            {
                type: 'confirm',
                name: 'useGit',
                message:
                    'Would you like to enable automatic GitHub integration ' +
                    'for this service?',
                default: true,
            },
        ] as QuestionCollection);

        useGit = answer.useGit;
    }

    return !!useGit;
}

/**
 * Resolves the docker registry section when dockerization is requested.
 */
async function resolveRegistry(
    argv: any,
    structured: StructuredConfig,
    global: IMQCLIConfig,
    interactive: boolean,
): Promise<{
    want: boolean;
    namespace: string;
    user: string;
    password: string;
}> {
    let want = argv.D || global.useDocker;

    if (!want && typeof global.useDocker === 'undefined' && interactive) {
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
        return { want: false, namespace: '', user: '', password: '' };
    }

    let namespace = (argv.N || structured.registry.namespace || '').trim();

    if (!isNamespace(namespace) && interactive) {
        const answer = await inquirer.prompt<{ dockerNamespace: string }>([
            {
                type: 'input',
                name: 'dockerNamespace',
                message: 'Enter DockerHub namespace:',
            },
        ] as QuestionCollection);

        if (
            answer.dockerNamespace &&
            !isNamespace(answer.dockerNamespace.trim())
        ) {
            throw new TypeError('Given DockerHub namespace is invalid!');
        }

        namespace = answer.dockerNamespace.trim();
    }

    let user = structured.registry.auth?.user || '';
    let password = structured.registry.auth?.password || '';

    if (!user && interactive) {
        const answer = await inquirer.prompt<{ dockerHubUser: string }>([
            {
                type: 'input',
                name: 'dockerHubUser',
                message: 'Docker hub user:',
            },
        ] as QuestionCollection);

        user = answer.dockerHubUser.trim();
    }

    if (!password && interactive) {
        const answer = await inquirer.prompt<{ dockerHubPassword: string }>([
            {
                type: 'password',
                name: 'dockerHubPassword',
                message: 'Docker hub password:',
            },
        ] as QuestionCollection);

        password = answer.dockerHubPassword.trim();
    }

    return { want: true, namespace, user, password };
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
export async function buildCreatePlan(
    argv: any,
    sources: PlanSources,
): Promise<CreatePlan> {
    const { global, service, interactive, dryRun } = sources;
    const structured = deriveStructured({ ...global, ...service });

    const name = ensureName(argv.name);
    const className = camelCase(name);
    const version = ensureVersion(argv.serviceVersion ?? argv.V ?? '');
    const description =
        (argv.description || '').trim() || `${name} - IMQ based service`;
    const author = await resolveAuthor(argv, global, service, interactive);
    const email = await resolveEmail(argv, global, service, interactive);
    const homepage = (argv.H || '').trim();
    const bugs = (argv.B || '').trim();

    const useVcs = await resolveUseVcs(argv, global, interactive);

    const vcsConfig = { provider: '', namespace: '', private: true };
    let token = '';

    if (useVcs) {
        const providerId = await resolveVcsProvider(
            argv,
            structured,
            interactive,
        );
        const vcs = await resolveVcs(argv, structured, providerId, interactive);

        vcsConfig.provider = providerId;
        vcsConfig.namespace = vcs.namespace;
        vcsConfig.private = vcs.private;
        token = vcs.token;
    }

    // dockerization depends on a pushed repo; disable when git is off
    const registry = useVcs
        ? await resolveRegistry(argv, structured, global, interactive)
        : { want: false, namespace: '', user: '', password: '' };

    const dockerize = registry.want && !!registry.namespace;
    const ciProvider = await resolveCi(
        argv,
        structured,
        vcsConfig.provider,
        interactive,
    );
    const nodeTags = await resolveNodeTags(argv, interactive);
    const packages = await resolvePackages(
        argv.packages,
        Array.isArray(service.packages) ? service.packages : undefined,
        Array.isArray(global.packages) ? global.packages : undefined,
        loadCatalog(),
        interactive,
    );
    const license = resolveLicense(
        await resolveLicenseId(argv, global, interactive),
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
            provider: dockerize ? 'dockerhub' : undefined,
            namespace: registry.namespace || undefined,
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
        template: argv.template || 'default',
        license,
        // yargs boolean-negation turns `--no-install` into `install=false`,
        // so honor both the declared flag and the negated form
        noInstall: !!argv.noInstall || argv.install === false,
        useVcs,
        config,
        interactive,
        dryRun,
    };
}
