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
import * as os from 'os';
import chalk from 'chalk';
import * as semver from 'semver';
import * as inquirer from 'inquirer';
import {
    IMQCLIConfig,
    loadConfig,
    printError,
    loadTemplate,
    loadTemplates,
    createRepository,
    travisEncrypt,
    nodeVersion,
    dashed,
    camelCase,
    resolve,
    cpr,
    touch,
    wrap
} from '../../lib';
import { execSync } from 'child_process';

const commandExists = require('command-exists').sync;

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
function findLicense(name: string): any {
    const licenses = require('../../lib/licenses.json');

    for (let id of Object.keys(licenses)) {
        if (name === id ||
            name.toLowerCase() === id ||
            new RegExp(`^${name.toLowerCase()}`, 'i')
                .test(licenses[id].spdx_id)
        ) {
            return licenses[id];
        }
    }

    return null;
}

// istanbul ignore next
function updateLicenseText(
    text: string,
    author: string,
    email: string,
    serviceName: string,
    homepage: string
): string {
    const values: any = {
        'year': new Date().getFullYear(),
        'fullname': author,
        'email': email,
        'project': serviceName,
        'project_url': homepage
    };

    for (let varName of Object.keys(values)) {
        text = text.replace(`[${varName}]`, values[varName]);
    }

    return text;
}

// istanbul ignore next
async function ensureLicense(
    path:string,
    license: string,
    author: string,
    email: string,
    homepage: string,
    serviceName: string
): Promise<{ text: string, header: string, name: string, tag: string }> {
    let text = '';
    let header = '';
    let name = '';
    let tag = 'UNLICENSED';

    if (license === 'UNLICENSED') {
        header = `/*!
 * Copyright (c) ${new Date().getFullYear()} ${author} <${email}>
 * 
 * This software is private and is unlicensed. Please, contact
 * author for any licensing details.
 */`;
        text = `Copyright (c) ${new Date().getFullYear()} ${author} <${email}>

This software is private and is unlicensed. Please, contact
author for any licensing details.\n`
        name = license;
    } else {
        const lic: any = findLicense(license);
        text = updateLicenseText(
            lic.body + '\n',
            author, email, serviceName, homepage
        );
        name = lic.name;
        tag = lic.spdx_id;
        header = updateLicenseText(
            lic.header|| '',
            author, email, serviceName, homepage
        ) || `Copyright (c) ${new Date().getFullYear()} ${author} <${email}>

This software is licensed under ${lic.spdx_id} license.
Please, refer to LICENSE file in project's root directory for details.`;
        header = `/*!\n * ${header.split(/\r?\n/).join('\n * ')}\n */`;
    }

    try {
        fs.unlinkSync(resolve(path, 'LICENSE'))
    } catch (err) { /* ignore */ }
    touch(resolve(path, 'LICENSE'), wrap(text));

    return { text, header, name, tag };
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
function ensureDescription(description: string, name: string) {
    return description || `${dashed(name)} - IMQ based service`;
}

// istanbul ignore next
function ensureServiceRepo(baseUrl: string, name: string) {
    if (!baseUrl) {
        return '';
    }

    return `\n  "repository": {
    "type": "git",
    "url": "${baseUrl}/${dashed(name)}"
  },\n`;
}

// istanbul ignore next
function ensureServiceBugsPage(argv: Arguments) {
    let url = argv.B;

    if (!url && /github\.com/.test(argv.gitBaseUrl || '')) {
        url = `${argv.gitBaseUrl
            .replace(/^git@/, 'https://')}/${dashed(argv.name)}/issues`;
    }

    if (!url) {
        return '';
    }

    return `\n  "bugs": {
    "url": "${url}"
  },\n`;
}

// istanbul ignore next
function ensureServiceHomePage(argv: Arguments) {
    let url = argv.H;

    if (!url && /github\.com/.test(argv.gitBaseUrl || '')) {
        url = `${argv.gitBaseUrl
            .replace(/^git@/, 'https://')}/${dashed(argv.name)}`;
    }

    if (!url) {
        return '';
    }

    return `\n  "homepage": "${url}",\n`;
}

// istanbul ignore next
function ensureAuthorName(name: string) {
    name = name.trim();

    if (!name) {
        throw new TypeError('Author\'s name is required, but was not given!');
    }

    return name;
}

// istanbul ignore next
function ensureAuthorEmail(email: string) {
    email = email.trim();

    if (!/^[-a-z0-9.]+@[-a-z0-9.]+$/i.test(email)) {
        throw new TypeError('Author\'s email is required, but was not given!');
    }

    return email;
}

// istanbul ignore next
function ensureTravisTags(argv: Arguments): string[] {
    const tags = (argv.n || '').split(/\s+|\s*,\s*/);

    if (!tags.length) {
        tags.push('stable', 'latest');
    }

    return tags;
}

// istanbul ignore next
function ensureDockerNamespace(argv: Arguments) {
    const ns = (argv.N || '').trim();

    if (!ns) {
        throw new TypeError('Docker namespace is required, but was not given!');
    }

    return ns;
}

// istanbul ignore next
async function ensureDockerTag(argv: Arguments) {
    if (argv.L.trim()) {
        return argv.L.trim();
    }

    const tags = ensureTravisTags(argv);
    const version =  await nodeVersion(tags[0]);

    if (!version) {
        throw new TypeError('Node version is not specified!');
    }

    return version;
}

// istanbul ignore next
async function ensureDockerSecrets(argv: Arguments) {
    const owner = argv.u.trim();
    const name = ensureName(argv.name);

    let { dockerHubUser, dockerHubPassword, gitHubAuthToken } = config;

    if (!owner) {
        throw new TypeError('GitHub namespace required, but is empty!');
    }

    const repo = `${owner}/${name}`;

    if (!dockerHubUser) {
        const answer = await inquirer.prompt<{ dockerHubUser: string}>([{
            type: 'input',
            name: 'dockerHubUser',
            message: 'Docker hub user:'
        }]);

        if (!answer.dockerHubUser.trim()) {
            throw new TypeError(
                'DockerHub username required, but was not given!'
            );
        }

        dockerHubUser = answer.dockerHubUser;
    }

    if (!dockerHubPassword) {
        const answer = await inquirer.prompt<{ dockerHubPassword: string }>([{
            type: 'password',
            name: 'dockerHubPassword',
            message: 'Docker hub password:'
        }]);

        if (!answer.dockerHubPassword.trim()) {
            throw new TypeError(
                'DockerHub password required, but was not given!'
            );
        }

        dockerHubPassword = answer.dockerHubPassword;
    }

    if (!gitHubAuthToken) {
        const answer = await inquirer.prompt<{ gitHubAuthToken: string }>([{
            type: 'input',
            name: 'gitHubAuthToken',
            message: 'Enter GitHub auth token:',
        }]);

        if (!answer.gitHubAuthToken.trim()) {
            throw new TypeError(
                'Github auth token required, but was not given!'
            );
        }

        gitHubAuthToken = answer.gitHubAuthToken;
    }

    console.log('Encrypting secrets...');

    return [
        await travisEncrypt(
            repo, `DOCKER_USER="${dockerHubUser}"`, gitHubAuthToken
        ),
        await travisEncrypt(
            repo, `DOCKER_PASS="${dockerHubPassword}"`, gitHubAuthToken
        ),
    ];
}

// istanbul ignore next
function stripDockerization(argv: Arguments) {
    const path = resolve(argv.path);
    const travis = resolve(path, '.travis.yml');
    const docker = resolve(path, 'Dockerfile');

    if (fs.existsSync(travis)) {
        const travisYml = fs.readFileSync(travis, { encoding: 'utf8' });

        fs.writeFileSync(
            travis,
            travisYml.replace(/services:[\s\S]+?$/, ''),
            { encoding: 'utf8' }
        );
    }

    if (fs.existsSync(docker)) {
        fs.unlinkSync(docker);
    }
}

// istanbul ignore next
async function buildDockerCi(argv: Arguments): Promise<void> {
    const dockerNs = ensureDockerNamespace(argv);
    const dockerize = !!(argv.g && argv.u && dockerNs && (
        argv.D || config.useDocker
    ));

    if (!dockerize) {
        return stripDockerization(argv);
    }

    console.log('Building docker <-> CI integration...');

    const tags = {
        TRAVIS_NODE_TAG: ensureTravisTags(argv).map(t => `- ${t}`).join('\n'),
        DOCKER_NAMESPACE: dockerNs,
        NODE_DOCKER_TAG: await ensureDockerTag(argv),
        DOCKER_SECRETS:
            `- ${(await ensureDockerSecrets(argv)).join('\n  - ')}`,
    };

    console.log('Updating docker and CI configs...');
    compileTemplate(resolve(argv.path), tags);
}

// istanbul ignore next
async function buildTags(path: string, argv: Arguments) {
    const name = ensureName(argv.name);
    const author = ensureAuthorName(argv.author);
    const email = ensureAuthorEmail(argv.email);
    const homepage = ensureServiceHomePage(argv);
    const license = await ensureLicense(
        path, argv.license, author, email, homepage, name
    );

    return {
        SERVICE_NAME: name,
        SERVICE_CLASS_NAME: camelCase(name),
        SERVICE_VERSION: ensureVersion(argv.serviceVersion),
        SERVICE_DESCRIPTION: ensureDescription(argv.description, name),
        SERVICE_REPO: ensureServiceRepo(argv.u, name),
        SERVICE_BUGS: ensureServiceBugsPage(argv),
        SERVICE_HOMEPAGE: homepage,
        SERVICE_AUTHOR_NAME: author,
        SERVICE_AUTHOR_EMAIL: `<${email}>`,
        LICENSE_HEADER: license.header,
        LICENSE_TEXT: license.text,
        LICENSE_NAME: license.name,
        LICENSE_TAG: license.tag,
    };
}

// istanbul ignore next
function createServiceFile(path:string, tags: any) {
    console.log('Creating main service file...');

    touch(resolve(path, 'src', `${tags.SERVICE_CLASS_NAME}.ts`),
        `${tags.LICENSE_HEADER}
import {
    IMQService,
    expose,
    profile,
} from 'imq-rpc';

export class ${tags.SERVICE_CLASS_NAME} extends IMQService {
    // Implement your service methods here, example:
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

// istanbul ignore next
function compileTemplateFile(text: string, tags: any): string {
    for (let tag of Object.keys(tags)) {
        text = text.replace(
            new RegExp(`%${tag}`, 'g'),
            tags[tag]
        );
    }

    return text;
}

// istanbul ignore next
function compileTemplate(path: string, tags: any) {
    fs.readdirSync(path).forEach((file: string) => {
        const filePath = resolve(path, file);

        if (fs.statSync(filePath).isDirectory()) {
            return compileTemplate(filePath, tags);
        }

        let content = compileTemplateFile(
            fs.readFileSync(filePath, { encoding: 'utf8' }),
            tags
        );

        fs.writeFileSync(filePath, content, { encoding: 'utf8' });
    });
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
    if (!/^[-_a-z-0-9]+$/i.test(argv.u)) {
        throw new TypeError(`Given github namespace "${argv.u}" is invalid!`);
    }

    return argv.u + '/' + dashed(argv.name);
}

let gitRepoInitialized = false;

// istanbul ignore next
async function createGitRepo(argv: Arguments) {
    if (!argv.T || !argv.T.trim()) {
        throw new Error('GitHub token required, but was not given!');
    }

    const url = await ensureGitRepo(argv);

    console.log('Creating github repository...');
    await createRepository(
        url,
        argv.T.trim(),
        ensureDescription(argv.description, ensureName(argv.name)),
        argv.p || config.gitRepoPrivate
    );

    gitRepoInitialized = true;
}

// istanbul ignore next
async function installPackages(argv: Arguments) {
    if (!commandExists('npm')) {
        throw new Error('npm command is not installed!');
    }

    const cwd = process.cwd();
    const path = resolve(argv.path);
    const pkg: any = require(resolve(path, 'package.json'));
    const deps = Object.keys(pkg.dependencies);
    const devDeps = Object.keys(pkg.devDependencies);

    process.chdir(path);

    if (deps && deps.length) {
        console.log('Installing dependencies...')
        execSync(`npm i --save ${deps.join(' ')}`);
    }

    if (devDeps && devDeps.length) {
        console.log('Installing dev dependencies...');
        execSync(`npm i --save-dev ${devDeps.join(' ')}`);
    }

    process.chdir(cwd);
}

// istanbul ignore next
async function commit(argv: Arguments) {
    const path = resolve(argv.path);
    const name = ensureName(argv.name);
    const owner = (argv.u || '').trim();
    const cwd = process.cwd();
    let url = config.gitBaseUrl;

    if (!owner && !url) {
        throw new TypeError('GitHub namespace missing!');
    } else if (owner) {
        url = `git@github.com:${owner}/${name}.git`;
    } else {
        url += `/${name}.git`;
    }

    process.chdir(path);

    if (!commandExists('git')) {
        throw new Error('Git command expected, but is not installed!');
    }

    console.log('Committing changes...');
    execSync(`git init && \
git add . && \
git commit -am "Initial commit" && 
git remote add origin ${url} && \
git push origin master`);

    process.chdir(cwd);
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
            .default('a', config.author || os.userInfo().username)

            .alias('e', 'email')
            .describe('e', 'Service author\'s contact email')
            .default('e', config.email || '')

            .alias('g', 'use-git')
            .describe('g', 'Turns on automatic git repo creation')
            .boolean('g')
            .default('g', config.useGit)

            .alias('u', 'github-namespace')
            .describe('u', 'GitHub namespace (usually user name or ' +
                'organization name)')
            .default('u', (config.gitBaseUrl || '').split(':').pop() || '')

            .describe('no-install', 'Do not install npm packages ' +
                'automatically on service creation')
            .boolean('no-install')
            .default('no-install', false)

            .alias('V', 'service-version')
            .describe('V', 'Initial service version')
            .default('V', '1.0.0')

            .alias('H', 'homepage')
            .describe('H', 'Homepage URL for service, if required')
            .default('H', '')

            .alias('B', 'bugs-url')
            .describe('B', 'Bugs url for service, if required')
            .default('B', '')

            .alias('l', 'license')
            .describe('l', 'License for created service, should be either ' +
                'license name in SPDX format or path to a custom license file')
            .default('l', config.license || 'UNLICENSED')

            .alias('t', 'template')
            .describe('t', 'Template used to create service (should be ' +
                'either template name, git url or file system directory)')
            .default('t', config.template || 'default')

            .alias('d', 'description')
            .describe('d', 'Service description')
            .default('d', '')

            .alias('n', 'node-versions')
            .describe('n', 'Node version tags to use for builds, separated ' +
                'by comma if multiple. First one will be used for docker ' +
                'build, if dockerize option enabled.')
            .default('n', 'stable, latest')

            .alias('D', 'dockerize')
            .describe('D', 'Enable service dockerization with CI builds')
            .boolean('D')

            .alias('L', 'node-docker-tag')
            .describe('L', 'Node docker tag to use as base docker image ' +
                'for docker builds')
            .default('L', '')

            .alias('N', 'docker-namespace')
            .describe('N', 'Docker hub namespace')
            .default('N', config.dockerHubNamespace)

            .alias('T', 'github-token')
            .describe('T', 'GitHub auth token')
            .default('T', config.gitHubAuthToken)

            .alias('p', 'private')
            .describe('p', 'Service repository will be private at GitHub')
            .boolean('p')

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

            await buildDockerCi(argv);

            if (!argv.noInstall) {
                await installPackages(argv);
            }

            if (gitRepoInitialized) {
                await commit(argv);
            }

            console.log(chalk.green('Service successfully created!'));
        }

        catch (err) {
            printError(err);
            console.error(err);
        }
    }
};
