/*!
 * IMQ-CLI command: service create - scaffolding
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
import * as fs from 'fs';
import * as p from 'path';
import {
    CUSTOM_TPL_HOME,
    findLicense,
    loadTemplate,
    loadTemplates,
    mkdirp,
    resolve,
    touch,
    wrap,
    dashed,
} from '../../lib/index.js';
import type { FileFragment } from '../providers/types.js';

export interface TemplateManifest {
    version: number;
    [key: string]: any;
}

export interface ResolvedLicense {
    text: string;
    header: string;
    name: string;
    tag: string;
}

export interface ServiceTokenInput {
    name: string;
    className: string;
    version: string;
    description: string;
    author: string;
    email: string;
    namespace: string;
    homepage: string;
    bugs: string;
    license: ResolvedLicense;
    addonPreload?: string;
    addonConfig?: string;
    // provider-derived URLs for the selected VCS host; when omitted, github
    // URLs are derived from `namespace` (backward-compatible default)
    repoUrl?: string;
    homeUrl?: string;
    bugsUrl?: string;
}

/**
 * Resolves a template reference to a local template directory. A reference may
 * be a filesystem path, a git url (ssh/https/bare `*.git`), the name of a
 * template in the pinned templates repo, or the name of a custom template
 * directory the user placed under `~/.imq/custom-templates/<name>`.
 *
 * @param {string} template
 * @param {string} [ref] - templates-repo git ref
 * @param {boolean} [interactive] - whether prompts are allowed (git-url reuse)
 * @return {Promise<string>}
 */
export async function ensureTemplate(
    template: string,
    ref?: string,
    interactive = false,
): Promise<string> {
    if (fs.existsSync(template)) {
        return template;
    }

    // a git url in any supported form (ssh, https, or a bare *.git)
    if (
        template.startsWith('git@') ||
        /^https?:\/\//.test(template) ||
        template.endsWith('.git')
    ) {
        return await loadTemplate(template, interactive);
    }

    // a bare name may be a custom template the user dropped under
    // ~/.imq/custom-templates/<name> (documented workflow)
    const custom = resolve(CUSTOM_TPL_HOME, template);

    if (fs.existsSync(custom)) {
        return custom;
    }

    const templates = await loadTemplates(ref);

    if (!templates[template]) {
        throw new Error(
            `No such template exists - "${template}". Provide a template ` +
                'name from the templates repo, a path, a git url, or place a ' +
                `custom template at ${resolve(CUSTOM_TPL_HOME, template)}.`,
        );
    }

    return templates[template];
}

/**
 * Reads a template's manifest (imq-template.json). Absent/unreadable manifest
 * means a legacy v1 template.
 *
 * @param {string} templatePath
 * @return {TemplateManifest | null}
 */
export function loadTemplateManifest(
    templatePath: string,
): TemplateManifest | null {
    try {
        return JSON.parse(
            fs.readFileSync(resolve(templatePath, 'imq-template.json'), {
                encoding: 'utf8',
            }),
        );
    } catch {
        return null;
    }
}

/**
 * Whether the scaffolded service is an ES module (package.json type=module),
 * which decides the module style of generated code.
 *
 * @param {string} servicePath
 * @return {boolean}
 */
export function isEsmService(servicePath: string): boolean {
    try {
        const pkg = JSON.parse(
            fs.readFileSync(resolve(servicePath, 'package.json'), {
                encoding: 'utf8',
            }),
        );

        return pkg.type === 'module';
    } catch {
        return false;
    }
}

/**
 * Overlays provider/addon file fragments onto a scaffolded service,
 * overwriting any same-named template file.
 *
 * @param {string} servicePath
 * @param {FileFragment[]} fragments
 */
export function overlayFragments(
    servicePath: string,
    fragments: FileFragment[],
): void {
    for (const fragment of fragments) {
        const full = resolve(servicePath, fragment.relPath);

        mkdirp(p.dirname(full));
        fs.writeFileSync(full, fragment.content, { encoding: 'utf8' });
    }
}

/**
 * Removes docker artifacts from a v2 service when dockerization is disabled.
 * (v2 templates ship no CI file, so only docker files are removed here.)
 *
 * @param {string} path
 */
export function removeDockerFiles(path: string): void {
    for (const file of ['Dockerfile', '.dockerignore']) {
        const full = resolve(path, file);

        if (fs.existsSync(full)) {
            fs.unlinkSync(full);
        }
    }
}

/**
 * Substitutes license placeholders ([year], [fullname], ...) throughout a
 * license text, replacing every occurrence.
 */
function updateLicenseText(
    text: string,
    author: string,
    email: string,
    serviceName: string,
    homepage: string,
): string {
    const values: Record<string, string> = {
        year: String(new Date().getFullYear()),
        fullname: author,
        email,
        project: serviceName,
        project_url: homepage,
    };

    for (const varName of Object.keys(values)) {
        text = text.split(`[${varName}]`).join(values[varName]);
    }

    return text;
}

/**
 * Produces the license text/header/name/tag for a resolved license id. Does
 * not prompt (selection happens during plan building). Supports the special
 * UNLICENSED value, SPDX ids/names from the bundled catalog, and a path to a
 * custom license file.
 *
 * @param {string} license - resolved license id, name, path, or "UNLICENSED"
 * @param {string} author
 * @param {string} email
 * @param {string} homepage
 * @param {string} serviceName
 * @return {ResolvedLicense}
 */
export function resolveLicense(
    license: string,
    author: string,
    email: string,
    homepage: string,
    serviceName: string,
): ResolvedLicense {
    const year = new Date().getFullYear();

    if (license === 'UNLICENSED') {
        return {
            header: `/*!
 * Copyright (c) ${year} ${author} <${email}>
 *
 * This software is private and is unlicensed. Please, contact
 * author for any licensing details.
 */`,
            text: `Copyright (c) ${year} ${author} <${email}>

This software is private and is unlicensed. Please, contact
author for any licensing details.\n`,
            name: 'UNLICENSED',
            tag: 'UNLICENSED',
        };
    }

    let lic: any = findLicense(license);

    // support a filesystem path to a custom license file
    if (!lic && fs.existsSync(resolve(license))) {
        lic = {
            body: fs.readFileSync(resolve(license), { encoding: 'utf8' }),
            name: 'CUSTOM',
            spdx_id: 'SEE LICENSE IN LICENSE',
            header: '',
        };
    }

    if (!lic) {
        throw new TypeError(
            `Unknown license "${license}". Provide a valid SPDX ` +
                'id/name or a path to a license file.',
        );
    }

    const text = updateLicenseText(
        lic.body + '\n',
        author,
        email,
        serviceName,
        homepage,
    );
    let header =
        updateLicenseText(
            lic.header || '',
            author,
            email,
            serviceName,
            homepage,
        ) ||
        `Copyright (c) ${year} ${author} <${email}>

This software is licensed under ${lic.spdx_id} license.
Please, refer to LICENSE file in project's root directory for details.`;

    header = `/*!\n * ${header.split(/\r?\n/).join('\n * ')}\n */`;

    return { text, header, name: lic.name, tag: lic.spdx_id };
}

/**
 * Writes the LICENSE file into the service directory, overwriting any file
 * shipped by the template.
 *
 * @param {string} path - service directory
 * @param {string} text - license body
 */
export function writeLicense(path: string, text: string): void {
    try {
        fs.unlinkSync(resolve(path, 'LICENSE'));
    } catch {
        /* nothing to remove */
    }

    touch(resolve(path, 'LICENSE'), wrap(text));
}

/**
 * Builds the package.json repository fragment token from a resolved repo URL.
 */
function serviceRepoToken(repoUrl: string): string {
    if (!repoUrl) {
        return '';
    }

    return `\n  "repository": {
    "type": "git",
    "url": "${repoUrl}"
  },\n`;
}

/**
 * Builds the homepage and bugs package.json fragment tokens, preferring the
 * explicit `-H`/`-B` values and otherwise the provider-derived URLs.
 */
function servicePagesTokens(
    homeUrl: string,
    bugsUrl: string,
    homepage: string,
    bugs: string,
): { home: string; bugs: string } {
    const home = homepage.trim() || homeUrl;
    const bugsFinal = bugs.trim() || bugsUrl;

    return {
        bugs: bugsFinal
            ? `\n  "bugs": {\n    "url": "${bugsFinal}"\n  },\n`
            : '',
        home: home ? `\n  "homepage": "${home}",\n` : '',
    };
}

/**
 * Builds the base %TOKEN map (service metadata + license) used to compile the
 * template tree.
 *
 * @param {ServiceTokenInput} input
 * @return {Record<string, string>}
 */
export function buildServiceTokens(
    input: ServiceTokenInput,
): Record<string, string> {
    const ns = input.namespace;
    // provider-derived URLs win; otherwise fall back to github URLs built from
    // the namespace (keeps behaviour for callers that pass only a namespace)
    const repoUrl =
        input.repoUrl || (ns ? `git@github.com:${ns}/${input.name}.git` : '');
    const homeUrl =
        input.homeUrl || (ns ? `https://github.com/${ns}/${input.name}` : '');
    const bugsUrl =
        input.bugsUrl ||
        (ns ? `https://github.com/${ns}/${input.name}/issues` : '');
    const { home, bugs } = servicePagesTokens(
        homeUrl,
        bugsUrl,
        input.homepage,
        input.bugs,
    );

    return {
        SERVICE_NAME: input.name,
        SERVICE_CLASS_NAME: input.className,
        SERVICE_VERSION: input.version,
        SERVICE_DESCRIPTION: input.description,
        SERVICE_REPO: serviceRepoToken(repoUrl),
        SERVICE_BUGS: bugs,
        SERVICE_HOMEPAGE: home,
        SERVICE_AUTHOR_NAME: input.author,
        SERVICE_AUTHOR_EMAIL: `<${input.email}>`,
        LICENSE_HEADER: input.license.header,
        LICENSE_TEXT: input.license.text,
        LICENSE_NAME: input.license.name,
        LICENSE_TAG: input.license.tag,
        // addon token points; populated by the package catalog (phase 3),
        // empty otherwise so v2 templates compile cleanly with no addons
        ADDON_PRELOAD: input.addonPreload || '',
        ADDON_CONFIG: input.addonConfig || '',
    };
}

/**
 * Generates the main service class source file.
 *
 * @param {string} path - service directory
 * @param {Record<string, string>} tokens
 */
export function createServiceFile(
    path: string,
    tokens: Record<string, string>,
    esm: boolean,
): void {
    console.log('Creating main service file...');

    const cls = tokens.SERVICE_CLASS_NAME;
    const pkgLoad = esm
        ? `import { createRequire } from 'node:module';\n\nconst require = ` +
          `createRequire(import.meta.url);\nconst pkg = require('../package.json');`
        : `const pkg = require('../package.json');`;

    touch(
        resolve(path, 'src', `${cls}.ts`),
        `${tokens.LICENSE_HEADER}
import { expose, IMQService, lock, logged, profile } from '@imqueue/rpc';
${pkgLoad}

export class ${cls} extends IMQService {
    /**
     * Returns current version of running service
     *
     * @return {{
     *     name: string,
     *     version: string,
     *     repository: string
     * }} - version of the service
     */
    @logged()
    @lock()
    @profile()
    @expose()
    public version(): { name: string; version: string; repository?: string } {
        const { name, version, repository } = pkg;
        return { name, version, repository: repository?.url };
    }

    // Implement your service methods below this line
}
`,
    );
}

/**
 * Generates the main service test file.
 *
 * @param {string} path - service directory
 * @param {Record<string, string>} tokens
 */
export function createServiceTestFile(
    path: string,
    tokens: Record<string, string>,
    esm: boolean,
): void {
    console.log('Creating main service test file...');

    const cls = tokens.SERVICE_CLASS_NAME;
    const content = esm
        ? `${tokens.LICENSE_HEADER}
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ${cls} } from '../../src/index.js';

const require = createRequire(import.meta.url);

describe('${cls}', () => {
    it('should be a class of IMQService', () => {
        assert.equal(typeof ${cls}, 'function');
        assert.equal(typeof (${cls}.prototype as any).describe, 'function');
    });

    describe('version()', () => {
        const service = new ${cls}();
        const pkg = require('../../package.json');

        it('should be a function', () => {
            assert.equal(typeof service.version, 'function');
        });

        it('should return proper name string', async () => {
            assert.equal((await service.version()).name, pkg.name);
        });

        it('should return proper version string', async () => {
            assert.equal((await service.version()).version, pkg.version);
        });
    });
});
`
        : `${tokens.LICENSE_HEADER}
import { expect } from 'chai';
import { ${cls} } from '../../src';


describe('${cls}', () => {
    it('should be a class of IMQService', () => {
        expect(typeof ${cls})
            .equals('function');
        expect(typeof (${cls}.prototype as any).describe)
            .equals('function');
    });

    describe('version()', () => {
        const service = new ${cls}();
        const pkg = require('../../package.json');

        it('should be a function', () => {
            expect(typeof service.version).equals('function');
        });

        it('should return proper name string', async () => {
            expect((await service.version()).name).equals(pkg.name);
        });

        it('should return proper version string', async () => {
            expect((await service.version()).version).equals(pkg.version);
        });
    });
});
`;

    touch(resolve(path, 'test/src', `${cls}.ts`), content);
}

/**
 * Compiles a single file's %TOKEN placeholders.
 */
function compileTemplateFile(
    text: string,
    tokens: Record<string, string>,
): string {
    for (const tag of Object.keys(tokens)) {
        // a function replacement inserts the value verbatim, so `$&`, `` $` ``,
        // `$'` or `$1` in a token value (e.g. an author name or license text)
        // are not interpreted as replacement patterns
        text = text.replace(new RegExp(`%${tag}`, 'g'), () => tokens[tag]);
    }

    return text;
}

/**
 * Recursively compiles %TOKEN placeholders across every file under a path,
 * skipping VCS/dependency directories and symlinks.
 *
 * @param {string} path - directory to compile
 * @param {Record<string, string>} tokens
 */
export function compileTemplate(
    path: string,
    tokens: Record<string, string>,
): void {
    for (const entry of fs.readdirSync(path, { withFileTypes: true })) {
        // never rewrite a pre-existing .git or node_modules (e.g. when the
        // target dir already existed), and never follow symlinks
        if (entry.name === '.git' || entry.name === 'node_modules') {
            continue;
        }

        const filePath = resolve(path, entry.name);

        if (entry.isSymbolicLink()) {
            continue;
        }

        if (entry.isDirectory()) {
            compileTemplate(filePath, tokens);

            continue;
        }

        if (!entry.isFile()) {
            continue;
        }

        const content = compileTemplateFile(
            fs.readFileSync(filePath, { encoding: 'utf8' }),
            tokens,
        );

        fs.writeFileSync(filePath, content, { encoding: 'utf8' });
    }
}

/**
 * Removes docker/legacy-CI artifacts from a v1 template when dockerization is
 * disabled (strips the travis services block and deletes docker files).
 *
 * @param {string} path - service directory
 */
export function stripDockerization(path: string): void {
    const travis = resolve(path, '.travis.yml');
    const docker = resolve(path, 'Dockerfile');
    const ignore = resolve(path, '.dockerignore');

    if (fs.existsSync(travis)) {
        const travisYml = fs.readFileSync(travis, { encoding: 'utf8' });

        fs.writeFileSync(travis, travisYml.replace(/services:[\s\S]+?$/, ''), {
            encoding: 'utf8',
        });
    }

    if (fs.existsSync(docker)) {
        fs.unlinkSync(docker);
    }

    if (fs.existsSync(ignore)) {
        fs.unlinkSync(ignore);
    }
}

/** re-export dashed for callers building names into tokens */
export { dashed };
