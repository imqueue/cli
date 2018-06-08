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
import {
    IMQCLIConfig,
    loadConfig,
    printError,
    loadTemplate,
    loadTemplates,
    dashed,
    camelCase,
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
async function ensureLicense(license: string) {
    return license;
}

// istanbul ignore next
async function buildFromTemplate(argv: Arguments) {
    const template = await ensureTemplate(argv.template);

    console.log(`Building service from template "${template}"...`);
}

// istanbul ignore next
async function licenseCode(argv: Arguments) {
    const license = await ensureLicense(argv.license);
    if (license === 'UNLICENSED') {
        return ; // nothing to do about license
    }

    console.log(`Licensing code with license ${license}...`);
}

// istanbul ignore next
async function ensureGitRepo(argv: Arguments) {
    if (!/^git@[-a-z0-9_.]+:[-a-z0-9_.\/]+$/i.test(argv.gitBaseUrl)) {
        throw new TypeError(
            `Given git base URL "${argv.gitBaseUrl}" is invalid!`
        );
    }

    return argv.gitBaseUrl + '/' + dashed(argv.name);
}

// istanbul ignore next
async function createGitRepo(argv: Arguments) {
    const repo = await ensureGitRepo(argv);
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

            .alias('l', 'license')
            .describe('l', 'License for created service, should be either ' +
                'license name in SPDX format or path to a custom license file')
            .default('l', config.license || 'UNLICENSED')

            .alias('t', 'template')
            .describe('t', 'Template used to create service (should be ' +
                'either template name, git url or file system directory)')
            .default('t', config.template)

            .default('name', `./${path.basename(process.cwd())}`)
            .describe('name', 'Service name to create with')

            .default('path', '.')
            .describe('path',
                'Path to directory where service will be generated to');
    },

    async handler(argv: Arguments) {
        try {
            await buildFromTemplate(argv);
            await licenseCode(argv);

            if (argv.g && argv.u) {
                await createGitRepo(argv);
            }

            console.log(chalk.green('Service successfully created!'));
        }

        catch (err) {
            printError(err);
        }
    }
};
