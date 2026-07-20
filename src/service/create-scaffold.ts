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
import {
    findLicense,
    loadTemplate,
    loadTemplates,
    resolve,
    touch,
    wrap,
    dashed,
} from '../../lib/index.js';

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
}

/**
 * Resolves a template reference (a filesystem path, a git url, or a known
 * template name) to a local template directory.
 *
 * @param {string} template
 * @return {Promise<string>}
 */
export async function ensureTemplate(template: string): Promise<string> {
    if (fs.existsSync(template)) {
        return template;
    }

    if (template.startsWith('git@')) {
        return await loadTemplate(template);
    }

    const templates = await loadTemplates();

    if (!templates[template]) {
        throw new Error(`No such template exists - "${template}"`);
    }

    return templates[template];
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
 * Builds the package.json repository fragment token.
 */
function serviceRepoToken(namespace: string, name: string): string {
    if (!namespace) {
        return '';
    }

    return `\n  "repository": {
    "type": "git",
    "url": "git@github.com:${namespace}/${name}.git"
  },\n`;
}

/**
 * Builds the homepage and bugs package.json fragment tokens, deriving GitHub
 * urls from the namespace only when not provided explicitly.
 */
function servicePagesTokens(
    namespace: string,
    name: string,
    homepage: string,
    bugs: string,
): { home: string; bugs: string } {
    let home = homepage.trim();
    let bugsUrl = bugs.trim();

    if (!home && namespace) {
        home = `https://github.com/${namespace}/${name}`;
    }

    if (!bugsUrl && namespace) {
        bugsUrl = `https://github.com/${namespace}/${name}/issues`;
    }

    return {
        bugs: bugsUrl ? `\n  "bugs": {\n    "url": "${bugsUrl}"\n  },\n` : '',
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
    const { home, bugs } = servicePagesTokens(
        input.namespace,
        input.name,
        input.homepage,
        input.bugs,
    );

    return {
        SERVICE_NAME: input.name,
        SERVICE_CLASS_NAME: input.className,
        SERVICE_VERSION: input.version,
        SERVICE_DESCRIPTION: input.description,
        SERVICE_REPO: serviceRepoToken(input.namespace, input.name),
        SERVICE_BUGS: bugs,
        SERVICE_HOMEPAGE: home,
        SERVICE_AUTHOR_NAME: input.author,
        SERVICE_AUTHOR_EMAIL: `<${input.email}>`,
        LICENSE_HEADER: input.license.header,
        LICENSE_TEXT: input.license.text,
        LICENSE_NAME: input.license.name,
        LICENSE_TAG: input.license.tag,
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
): void {
    console.log('Creating main service file...');

    touch(
        resolve(path, 'src', `${tokens.SERVICE_CLASS_NAME}.ts`),
        `${tokens.LICENSE_HEADER}
import { expose, IMQService, lock, logged, profile } from '@imqueue/rpc';

export class ${tokens.SERVICE_CLASS_NAME} extends IMQService {
    /**
     * Service package data
     */
    private pkg = require('../package.json');

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
    public version(): { name: string; version: string; repository: string } {
        const { name, version, repository } = this.pkg;
        return { name, version, repository: repository.url };
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
): void {
    console.log('Creating main service test file...');

    touch(
        resolve(path, 'test/src', `${tokens.SERVICE_CLASS_NAME}.ts`),
        `${tokens.LICENSE_HEADER}
import { expect } from 'chai';
import { ${tokens.SERVICE_CLASS_NAME} } from '../../src';


describe('${tokens.SERVICE_CLASS_NAME}', () => {
    it('should be a class of IMQService', () => {
        expect(typeof ${tokens.SERVICE_CLASS_NAME})
            .equals('function');
        expect(typeof (${tokens.SERVICE_CLASS_NAME}.prototype as any).describe)
            .equals('function');
    });

    describe('version()', () => {
        const service = new ${tokens.SERVICE_CLASS_NAME}();
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
`,
    );
}

/**
 * Compiles a single file's %TOKEN placeholders.
 */
function compileTemplateFile(
    text: string,
    tokens: Record<string, string>,
): string {
    for (const tag of Object.keys(tokens)) {
        text = text.replace(new RegExp(`%${tag}`, 'g'), tokens[tag]);
    }

    return text;
}

/**
 * Recursively compiles %TOKEN placeholders across every file under a path.
 *
 * @param {string} path - directory to compile
 * @param {Record<string, string>} tokens
 */
export function compileTemplate(
    path: string,
    tokens: Record<string, string>,
): void {
    fs.readdirSync(path).forEach((file: string) => {
        const filePath = resolve(path, file);

        if (fs.statSync(filePath).isDirectory()) {
            return compileTemplate(filePath, tokens);
        }

        const content = compileTemplateFile(
            fs.readFileSync(filePath, { encoding: 'utf8' }),
            tokens,
        );

        fs.writeFileSync(filePath, content, { encoding: 'utf8' });
    });
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
