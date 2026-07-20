/*!
 * IMQ-CLI command: service create - pipeline
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
import { styleText } from 'node:util';
import { execFileSync } from 'child_process';
import { DEFAULT_TEMPLATES_REF, commandExists, cpr } from '../../lib/index.js';
import {
    ciProviders,
    registerBuiltinProviders,
    scmTools,
    vcsHosts,
} from '../providers/index.js';
import type { FileFragment } from '../providers/types.js';
import { loadCatalog } from '../catalog/load.js';
import {
    type AddonResult,
    mergeDependencies,
    resolveAddons,
} from '../catalog/apply.js';
import type { CreatePlan } from './create-plan.js';
import {
    buildServiceTokens,
    compileTemplate,
    createServiceFile,
    createServiceTestFile,
    ensureTemplate,
    isEsmService,
    loadTemplateManifest,
    overlayFragments,
    removeDockerFiles,
    stripDockerization,
    writeLicense,
} from './create-scaffold.js';

/** mutable state shared with the caller so rollback can act on it */
export interface CreateState {
    repoCreated: boolean;
}

/**
 * Prints a human-readable summary of the resolved plan. Used for the confirm
 * step and for --dry-run.
 *
 * @param {CreatePlan} plan
 */
export function printPlanSummary(plan: CreatePlan): void {
    const line = (label: string, value: string) =>
        console.log('  ' + styleText('yellow', `${label}:`) + ' ' + value);

    console.log(styleText(['bold', 'green'], '\nService creation plan:'));
    line('name', plan.name);
    line('path', plan.path);
    line('version', plan.version);
    line('license', plan.license.name);
    line('template', plan.template);
    line(
        'vcs',
        plan.useVcs
            ? `${plan.config.vcs.provider} (${plan.config.vcs.namespace}, ` +
                  `${plan.config.vcs.private ? 'private' : 'public'})`
            : styleText('gray', 'disabled'),
    );
    line('ci', plan.config.ci.provider || styleText('gray', 'none'));
    line(
        'registry',
        plan.dockerize
            ? `${plan.config.registry.provider} (${plan.config.registry.namespace})`
            : styleText('gray', 'no dockerization'),
    );
    line('node', plan.nodeTags.join(', '));
    line(
        'packages',
        plan.config.packages.length
            ? plan.config.packages.join(', ')
            : styleText('gray', 'none'),
    );
    console.log('');
}

/**
 * Scaffolds the service from its template: copy, write LICENSE, compile base
 * tokens, and generate the service class and test files.
 */
function scaffold(
    plan: CreatePlan,
    templatePath: string,
    fragments: FileFragment[],
    addons: AddonResult,
): void {
    console.log(`Building service from template "${templatePath}"...`);
    cpr(templatePath, plan.path);

    // v2: overlay provider/addon fragments before compilation so their
    // %TOKENS are substituted alongside the template's own
    if (fragments.length) {
        overlayFragments(plan.path, fragments);
    }

    const tokens = buildServiceTokens({
        name: plan.name,
        className: plan.className,
        version: plan.version,
        description: plan.description,
        author: plan.author,
        email: plan.email,
        namespace: plan.config.vcs.namespace || '',
        homepage: plan.homepage,
        bugs: plan.bugs,
        license: plan.license,
        addonPreload: addons.preload,
        addonConfig: addons.config,
    });

    writeLicense(plan.path, plan.license.text);
    compileTemplate(plan.path, tokens);

    // module style follows the (now compiled) service package.json
    const esm = isEsmService(plan.path);

    createServiceFile(plan.path, tokens, esm);
    createServiceTestFile(plan.path, tokens, esm);
}

/**
 * Compiles the CI/docker tokens contributed by the CI provider, stripping
 * docker artifacts when dockerization is disabled, and activates builds when
 * a repository exists (never fatal).
 */
async function applyCi(
    plan: CreatePlan,
    repoCreated: boolean,
    isV2: boolean,
): Promise<void> {
    const ci = ciProviders.get(plan.config.ci.provider as string);
    const tokens = await ci.tokens(plan);

    if (!plan.dockerize) {
        // v2 templates ship no CI file (it is a provider fragment), so only
        // docker files need removing; v1 also strips the baked travis block
        if (isV2) {
            removeDockerFiles(plan.path);
        } else {
            stripDockerization(plan.path);
        }
    }

    if (repoCreated && ci.enable) {
        try {
            await ci.enable(plan);
        } catch {
            console.log(
                styleText(
                    'red',
                    'There was a problem enabling builds for this service. ' +
                        'Please enable them manually in your CI provider.',
                ),
            );
        }
    }

    console.log('Updating docker and CI configs...');
    compileTemplate(plan.path, tokens);
}

/**
 * Installs the service dependencies exactly as declared by the template's
 * package.json.
 */
function installPackages(plan: CreatePlan): void {
    if (!commandExists('npm')) {
        throw new Error('npm command is not installed!');
    }

    console.log('Installing dependencies...');
    execFileSync('npm', ['install'], { cwd: plan.path, stdio: 'inherit' });
}

/**
 * Runs the full create pipeline for a resolved plan, delegating hosting/CI/
 * scm concerns to the selected providers. Mutates `state.repoCreated` so the
 * caller can roll back a created remote repository on failure.
 *
 * @param {CreatePlan} plan - fully resolved, immutable plan
 * @param {CreateState} state - mutable state shared with the caller
 * @return {Promise<void>}
 */
export async function runCreate(
    plan: CreatePlan,
    state: CreateState,
): Promise<void> {
    registerBuiltinProviders();

    // 1. SCAFFOLD
    const templatePath = await ensureTemplate(
        plan.template,
        plan.config.templatesRef || DEFAULT_TEMPLATES_REF,
    );
    const manifest = loadTemplateManifest(templatePath);
    const isV2 = !!manifest && (manifest.version ?? 0) >= 2;
    const ci = ciProviders.get(plan.config.ci.provider as string);
    const addons = resolveAddons(plan.config.packages, loadCatalog());

    // v2 templates ship no CI files; the CI provider contributes them.
    // addon files are overlaid regardless (they are independent files)
    const fragments = [...(isV2 ? ci.files(plan) : []), ...addons.files];

    scaffold(plan, templatePath, fragments, addons);

    // merge addon dependencies into the (now compiled) package.json
    mergeDependencies(plan.path, addons.deps, addons.devDeps);

    // v1 templates lack %ADDON token points, so code snippets can't inject
    if (addons.hasSnippets && !isV2) {
        console.log(
            styleText(
                'yellow',
                'Selected addons include code snippets, but this template ' +
                    'has no addon insertion points - dependencies were added, ' +
                    'wire the code manually.',
            ),
        );
    }

    // 2. VCS - create the remote repository
    if (plan.useVcs) {
        const vcs = vcsHosts.get(plan.config.vcs.provider as string);

        console.log(`Creating ${vcs.title} repository...`);
        await vcs.createRepository(plan);
        state.repoCreated = true;
    }

    // 3. CI + docker tokens/activation
    await applyCi(plan, state.repoCreated, isV2);

    // 4. INSTALL
    if (!plan.noInstall) {
        installPackages(plan);
    }

    // 5. COMMIT + push
    if (state.repoCreated) {
        const vcs = vcsHosts.get(plan.config.vcs.provider as string);
        const scm = scmTools.get('git');
        const remoteUrl = vcs.remoteUrl(
            plan.config.vcs.namespace as string,
            plan.name,
        );

        await scm.initAndPush(plan, remoteUrl);
    }

    // 6. REPORT
    for (const note of ci.instructions(plan)) {
        console.log(styleText('cyan', note));
    }

    for (const note of addons.instructions) {
        console.log(styleText('cyan', note));
    }

    if (addons.env.length) {
        console.log(
            styleText(
                'cyan',
                `Addon environment variables: ${addons.env.join(', ')}`,
            ),
        );
    }
}
