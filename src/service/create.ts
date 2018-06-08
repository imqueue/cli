/*!
 * IMQ-CLI command: service create
 *
 * Copyright (c) 2018, Mykhailo Stadnyk <mikhus@gmail.com>
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 * OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */
import * as path from 'path';
import { Argv, Arguments } from 'yargs';
import * as fs from 'fs';
import chalk from 'chalk';
import * as semver from 'semver';
import {
    IMQCLIConfig,
    loadConfig,
    printError,
    loadTemplate,
    loadTemplates,
    dashed,
    camelCase,
    resolve,
    cpr,
    touch,
} from '../../lib';

let config: IMQCLIConfig;

// istanbul ignore next
async function ensureTemplate(template: string) {
    if (fs.existsSync(template)) {
        return template;
    }

    if (/^git@/.test(template)) {
        // template is a git url
        return await loadTemplate(template);
    }

    // template is a name
    const templates = await loadTemplates();

    if (!templates[template]) {
        throw new Error(`No such template exists - "${template}"`);
    }

    return templates[template];
}

// istanbul ignore next
async function ensureLicense(
    path:string,
    license: string
): Promise<{ text: string, header: string }> {
    let text = '';
    let header = '';

    return { text, header };
}

// istanbul ignore next
function ensureName(name: string) {
    if (!name.trim()) {
        throw new TypeError(`Service name expected, but was not given!`);
    }

    return dashed(name.trim());
}

// istanbul ignore next
function ensureVersion(version: string) {
    if (!version.trim()) {
        version = '1.0.0';
    }

    if (!semver.valid(version)) {
        throw new TypeError('Given version is invalid, please, provide ' +
            'valid semver format!')
    }

    return version;
}

// istanbul ignore next
function ensureDescription(description: string) {
    return description || '';
}

// istanbul ignore next
function ensureServiceRepo(argv: Arguments) {

}

// istanbul ignore next
function ensureServiceBugsPage(argv: Arguments) {

}

// istanbul ignore next
function ensureServiceHomePage(argv: Arguments) {

}

// istanbul ignore next
function ensureAuthorName(name: string) {

}

// istanbul ignore next
function ensureAuthorEmail(email: string) {

}

// istanbul ignore next
function ensureTravisTag(argv: Arguments) {

}

// istanbul ignore next
function ensureDockerNamespace(argv: Arguments) {

}

// istanbul ignore next
function ensureDockerTag(argv: Arguments) {

}

// istanbul ignore next
async function buildTags(path: string, argv: Arguments) {
    const license = await ensureLicense(path, argv.license);
    const name = ensureName(argv.name);

    return {
        SERVICE_NAME: name,
        SERVICE_CLASS_NAME: camelCase(name),
        SERVICE_VERSION: ensureVersion(argv.serviceVersion),
        SERVICE_DESCRIPTION: ensureDescription(argv.description),
        SERVICE_REPO: ensureServiceRepo(argv),
        SERVICE_BUGS: ensureServiceBugsPage(argv),
        SERVICE_HOMEPAGE: ensureServiceHomePage(argv),
        SERVICE_AUTHOR_NAME: ensureAuthorName(argv.author),
        SERVICE_AUTHOR_EMAIL: ensureAuthorEmail(argv.email),
        SERVICE_LICENSE: license.text,
        SERVICE_LICENSE_HEADER: license.header,
        TRAVIS_NODE_TAG: ensureTravisTag(argv),
        DOCKER_NAMESPACE: ensureDockerNamespace(argv),
        NODE_DOCKER_TAG: ensureDockerTag(argv),
    }
}

// istanbul ignore next
function createServiceFile(path:string, tags: any) {
    touch(resolve(path, 'src', `${tags.SERVICE_CLASS_NAME}.ts`),
        `${tags.SERVICE_LICENSE_HEADER}
import {
    IMQService,
    expose,
    profile,
} from 'imq-rpc';

export class ${tags.SERVICE_CLASS_NAME} extends IMQService {
    // Implement your service here, example:
    // /**
    //  * Returns "Hello, World!" string
    //  * 
    //  * @return {string}
    //  */
    // @profile()
    // @expose()
    // public hello(): string {
    //     return "Hello, World"!
    // }
}
`);
}

function compileTemplate(path: string, tags: any) {

}

// istanbul ignore next
async function makeService(path: string, argv: Arguments) {
    const tags = await buildTags(path, argv);

    compileTemplate(path, tags);
    createServiceFile(path, tags);
}

// istanbul ignore next
async function buildFromTemplate(argv: Arguments) {
    const template = await ensureTemplate(argv.template);
    const path = resolve(argv.path);

    console.log(`Building service from template "${template}"...`);

    cpr(template, path);
    await makeService(path, argv);
}

// istanbul ignore next
async function ensureGitRepo(argv: Arguments) {
    if (!/^git@[-a-z0-9_.]+:[-a-z0-9_.\/]+$/i.test(argv.u)) {
        throw new TypeError(`Given git base URL "${argv.u}" is invalid!`);
    }

    return argv.gitBaseUrl + '/' + dashed(argv.name);
}

// istanbul ignore next
async function createGitRepo(argv: Arguments) {
    const repo = await ensureGitRepo(argv);
}

// istanbul ignore next
async function installPackages(argv: Arguments) {

}

// noinspection JSUnusedGlobalSymbols
export const { command, describe, builder, handler } = {
    command: 'create [name] [path]',
    describe: 'Creates new service package with the given service name ' +
              'under given path.',

    builder(yargs: Argv) {
        config = loadConfig();

        return yargs
            .alias('a', 'author')
            .describe('a', 'Service author full name (person or organization)')
            .default('a', config.author)

            .alias('e', 'email')
            .describe('e', 'Service author\'s contact email')
            .default('e', config.email)

            .alias('g', 'use-git')
            .describe('g', 'Turns on automatic git repo creation')
            .boolean('g')
            .default('g', config.useGit)

            .alias('u', 'git-url')
            .describe('u', 'Git repos base URL')
            .default('u', config.gitBaseUrl)

            .describe('no-install', 'Do not install npm packages ' +
                'automatically on service creation')
            .boolean('no-install')
            .default('no-install', false)

            .alias('V', 'service-version')
            .describe('V', 'Initial service version')
            .default('V', '1.0.0')

            .alias('l', 'license')
            .describe('l', 'License for created service, should be either ' +
                'license name in SPDX format or path to a custom license file')
            .default('l', config.license || 'UNLICENSED')

            .alias('t', 'template')
            .describe('t', 'Template used to create service (should be ' +
                'either template name, git url or file system directory)')
            .default('t', config.template)

            .alias('d', 'description')
            .describe('d', 'Service description')
            .default('d', '')

            .default('name', `./${path.basename(process.cwd())}`)
            .describe('name', 'Service name to create with')

            .default('path', '.')
            .describe('path',
                'Path to directory where service will be generated to');
    },

    async handler(argv: Arguments) {
        try {
            await buildFromTemplate(argv);

            if (argv.g && argv.u) {
                await createGitRepo(argv);
            }

            if (!argv.noInstall) {
                await installPackages(argv);
            }

            console.log(chalk.green('Service successfully created!'));
        }

        catch (err) {
            printError(err);
        }
    }
};
