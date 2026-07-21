/*!
 * @imqueue/cli providers: types
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
import type { StructuredConfig } from '../../lib/config-schema.js';

/**
 * Every provider is identified by a stable id and a human title, so the
 * registry can list/prompt them uniformly.
 */
export interface Provider {
    id: string;
    title: string;
}

/**
 * A single secret to be provisioned into a CI system (name plus its plaintext
 * value). The value never reaches logs.
 */
export interface Secret {
    name: string;
    value: string;
}

/**
 * Describes a secret a registry needs and how a user can obtain it, so the CI
 * layer can surface consistent guidance regardless of registry.
 */
export interface SecretSpec {
    name: string;
    describe: string;
}

/**
 * How a provider expects to authenticate, used to drive prompting for just
 * the credentials a given provider needs.
 */
export interface AuthSpec {
    /** config dot-path where the credential lives, e.g. 'vcs.auth.token' */
    path: string;
    /** prompt label */
    describe: string;
    /** whether the input should be masked */
    secret?: boolean;
}

/**
 * A file fragment overlaid onto a scaffolded service before token compilation.
 * relPath is relative to the service root; content may carry %TOKENS.
 */
export interface FileFragment {
    relPath: string;
    content: string;
}

/**
 * The immutable, fully-resolved plan for a single `service create` run. Passed
 * to every provider; providers never re-resolve options themselves.
 */
export interface CreateContext {
    /** absolute path to the service being created */
    path: string;
    /** dashed service name */
    name: string;
    /** camel-cased service class name */
    className: string;
    /** service version (semver) */
    version: string;
    description: string;
    author: string;
    email: string;
    /** whether dockerization is enabled */
    dockerize: boolean;
    /** node version tags to build against (CI matrix / docker base) */
    nodeTags: string[];
    /** explicit base node docker tag override, if any */
    nodeDockerTag?: string;
    /** resolved structured config for this run */
    config: StructuredConfig;
    /** whether interactive prompting is allowed */
    interactive: boolean;
    /** when true, no side effects (network, fs writes) should occur */
    dryRun: boolean;
}

/**
 * VCS hosting provider (github/gitlab/bitbucket). Handles repository lifecycle
 * over the host's HTTP API and derives repository urls.
 */
export interface VcsHostProvider extends Provider {
    remoteUrl(namespace: string, name: string, proto?: 'ssh' | 'https'): string;
    webUrl(namespace: string, name: string): string;
    bugsUrl(namespace: string, name: string): string;
    createRepository(ctx: CreateContext): Promise<void>;
    /** optional rollback of a repository this run created */
    deleteRepository?(ctx: CreateContext): Promise<void>;
    authSpec: AuthSpec;
    /**
     * Basic-auth username to pair with the access token when pushing over
     * HTTPS (the token goes in the password field). Host-specific:
     * `x-access-token` (GitHub), `oauth2` (GitLab), `x-token-auth`
     * (Bitbucket). Absent means the host has no token-over-HTTPS push scheme.
     */
    httpAuthUser?: string;
}

/**
 * Credentials for an HTTPS git push: the basic-auth username plus the access
 * token used as the password. Injected ephemerally per push so the token is
 * never persisted into the repository's git config.
 */
export interface ScmAuth {
    user: string;
    token: string;
}

/**
 * Source control tool operating on the local working copy (git only, for now).
 */
export interface ScmProvider extends Provider {
    initAndPush(
        ctx: CreateContext,
        remoteUrl: string,
        auth?: ScmAuth,
    ): Promise<void>;
}

/**
 * Continuous integration provider. Always able to emit config files; enabling
 * builds and provisioning secrets are optional capabilities.
 */
export interface CiProvider extends Provider {
    /** vcs host ids this CI supports; empty means "any" */
    supportedVcs: string[];
    /** config file fragments to overlay into the service */
    files(ctx: CreateContext): FileFragment[];
    /** token values this CI contributes to template compilation */
    tokens(
        ctx: CreateContext,
    ): Record<string, string> | Promise<Record<string, string>>;
    /** optional: activate builds for the repository */
    enable?(ctx: CreateContext): Promise<void>;
    /** optional: provision CI secrets */
    setSecrets?(ctx: CreateContext, secrets: Secret[]): Promise<void>;
    /** post-create guidance to print */
    instructions(ctx: CreateContext): string[];
}

/**
 * Container registry provider. Produces the image reference and the shell
 * snippets a CI uses to log in and push, plus the secrets it requires.
 */
/**
 * A configuration field a registry needs (e.g. region, project), resolved into
 * config.registry[key] from flags/config/prompt.
 */
export interface RegistryOption {
    key: string;
    describe: string;
    required?: boolean;
}

export interface ContainerRegistryProvider extends Provider {
    /** config fields this registry needs (region/project/namespace/...) */
    options?: RegistryOption[];
    imageRef(ctx: CreateContext): string;
    /** secret names this registry needs, plus how to obtain them */
    secretSpecs(ctx: CreateContext): SecretSpec[];
    /** the resolved name/value secret pairs available for provisioning */
    secrets(ctx: CreateContext): Secret[];
    loginCmd(ctx: CreateContext): string;
    pushCmd(ctx: CreateContext): string;
}
