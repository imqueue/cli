/*!
 * IMQ-CLI command: service create
 *
 * I'm Queue Software Project
 * Copyright (C) 2025  imqueue.com <support@imqueue.com>
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
import * as path from 'path';
import { type Argv } from 'yargs';
import * as fs from 'fs';
import * as os from 'os';
import * as semver from 'semver';
import inquirer, { type QuestionCollection } from 'inquirer';
import {
    commandExists,
    type IMQCLIConfig,
    loadConfig,
    printError,
    loadTemplate,
    loadTemplates,
    createRepository,
    licensingOptions,
    findLicense,
    travisEncrypt,
    nodeVersion,
    dashed,
    camelCase,
    resolve,
    isEmail,
    cpr,
    touch,
    wrap,
    rmdir,
    isNamespace,
    isGithubToken,
    enableBuilds,
    toTravisTags,
    OS_HOME,
} from '../../lib/index.js';
import { execFileSync } from 'child_process';

const DEFAULT_SERVICE_VERSION = '1.0.0-0';

let config: IMQCLIConfig;

async function ensureTemplate(template: string) {
    if (fs.existsSync(template)) {
        return template;
    }

    if (template.startsWith('git@')) {
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

function updateLicenseText(
    text: string,
    author: string,
    email: string,
    serviceName: string,
    homepage: string,
): string {
    const values: any = {
        year: new Date().getFullYear(),
        fullname: author,
        email: email,
        project: serviceName,
        project_url: homepage,
    };

    for (let varName of Object.keys(values)) {
        // replace every occurrence, not just the first
        text = text.split(`[${varName}]`).join(String(values[varName]));
    }

    return text;
}

async function ensureLicense(
    path: string,
    license: string,
    author: string,
    email: string,
    homepage: string,
    serviceName: string,
): Promise<{ text: string; header: string; name: string; tag: string }> {
    let text = '';
    let header = '';
    let name = '';
    let tag = 'UNLICENSED';

    if (license === 'UNLICENSED' && typeof config.license === 'undefined') {
        const userLicense = await licensingOptions();

        tag = userLicense.id;
        name = userLicense.name;
        license = tag;
    }

    if (license === 'UNLICENSED') {
        header = `/*!
 * Copyright (c) ${new Date().getFullYear()} ${author} <${email}>
 *
 * This software is private and is unlicensed. Please, contact
 * author for any licensing details.
 */`;
        text = `Copyright (c) ${new Date().getFullYear()} ${author} <${email}>

This software is private and is unlicensed. Please, contact
author for any licensing details.\n`;
        name = license;
    } else {
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

        text = updateLicenseText(
            lic.body + '\n',
            author,
            email,
            serviceName,
            homepage,
        );
        name = lic.name;
        tag = lic.spdx_id;
        header =
            updateLicenseText(
                lic.header || '',
                author,
                email,
                serviceName,
                homepage,
            ) ||
            `Copyright (c) ${new Date().getFullYear()} ${author} <${email}>

This software is licensed under ${lic.spdx_id} license.
Please, refer to LICENSE file in project's root directory for details.`;
        header = `/*!\n * ${header.split(/\r?\n/).join('\n * ')}\n */`;
    }

    try {
        fs.unlinkSync(resolve(path, 'LICENSE'));
    } catch {
        /* ignore */
    }
    touch(resolve(path, 'LICENSE'), wrap(text));

    return { text, header, name, tag };
}

function ensureName(name: string) {
    if (!name.trim()) {
        throw new TypeError(`Service name expected, but was not given!`);
    }

    return dashed(name.trim());
}

function ensureVersion(version: string) {
    if (!version.trim()) {
        version = DEFAULT_SERVICE_VERSION;
    }

    if (!semver.valid(version)) {
        throw new TypeError(
            'Given version is invalid, please, provide ' +
                'valid semver format!',
        );
    }

    return version;
}

function ensureDescription(description: string, name: string) {
    return description || `${dashed(name)} - IMQ based service`;
}

function ensureServiceRepo(owner: string, name: string) {
    if (!owner) {
        return '';
    }

    return `\n  "repository": {
    "type": "git",
    "url": "git@github.com:${owner}/${dashed(name)}.git"
  },\n`;
}

function ensureServicePages(argv: any): {
    home: string;
    bugs: string;
} {
    const owner = (argv.u || '').trim();
    const name = dashed(argv.name);
    let home = (argv.H || '').trim();
    let bugs = (argv.B || '').trim();

    // fall back to GitHub-derived urls only when not provided explicitly
    if (!home && owner) {
        home = `https://github.com/${owner}/${name}`;
    }

    if (!bugs && owner) {
        bugs = `https://github.com/${owner}/${name}/issues`;
    }

    return {
        bugs: bugs ? `\n  "bugs": {\n    "url": "${bugs}"\n  },\n` : '',
        home: home ? `\n  "homepage": "${home}",\n` : '',
    };
}

async function ensureAuthorName(name: string) {
    name = name.trim();

    if (!name) {
        const answer: { authorName: string } = await inquirer.prompt<{
            authorName: string;
        }>([
            {
                type: 'input',
                name: 'authorName',
                message: "Enter author's name:",
                default: os.userInfo().username,
            },
        ] as QuestionCollection);

        name = answer.authorName.trim() || os.userInfo().username;
    }

    return name;
}

async function ensureAuthorEmail(email: string) {
    email = email.trim();

    if (!isEmail(email)) {
        const answer: { email: string } = await inquirer.prompt<{
            email: string;
        }>([
            {
                type: 'input',
                name: 'email',
                message: "Enter author's email:",
            },
        ] as QuestionCollection);

        if (!isEmail(answer.email)) {
            throw new TypeError(
                "Author's email is required, but was not given!",
            );
        }

        email = answer.email;
    }

    return email;
}

async function ensureTravisTags(argv: any): Promise<string[]> {
    if (argv.n instanceof Array && argv.n.length) {
        return argv.n;
    }

    let tags = (argv.n || '').split(/\s+|\s*,\s*/).filter((t: string) => t);

    if (!tags.length) {
        let answer: { tags: string } = await inquirer.prompt<{ tags: string }>([
            {
                type: 'input',
                name: 'tags',
                message:
                    'Enter node version(s) for CI builds (comma-separated ' +
                    'if multiple):',
                default: 'stable, latest',
            },
        ] as QuestionCollection);

        if (!answer.tags) {
            tags.push('stable', 'latest');
        } else {
            tags = answer.tags.split(/\s+|\s*,\s*/);
        }
    }

    argv.n = argv.nodeVersions = tags = await toTravisTags(tags);

    return tags;
}

async function ensureDockerNamespace(argv: any) {
    let ns = (argv.N || '').trim();
    let dockerize = argv.D || config.useDocker;
    let answer: {
        useDocker?: boolean;
        dockerNamespace?: string;
    };

    if (!dockerize && typeof config.useDocker === 'undefined') {
        answer = await inquirer.prompt<{ useDocker: boolean }>([
            {
                type: 'confirm',
                name: 'useDocker',
                message: 'Would you like to dockerize your service?',
                default: true,
            },
        ] as QuestionCollection);

        config.useDocker =
            argv.D =
            argv.dockerize =
            dockerize =
                answer.useDocker;
    }

    if (dockerize && !isNamespace(ns)) {
        answer = await inquirer.prompt<{ dockerNamespace: string }>([
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

        config.dockerHubNamespace =
            argv.N =
            argv.dockerNamespace =
            ns =
                answer.dockerNamespace;
    }

    return ns;
}

async function ensureDockerTag(argv: any) {
    if (argv.L.trim()) {
        return argv.L.trim();
    }

    const tags = await ensureTravisTags(argv);
    const version = await nodeVersion(tags[0]);

    if (!version) {
        throw new TypeError('Invalid node version specified!');
    }

    return version;
}

async function ensureDockerSecrets(argv: any) {
    const owner = argv.u.trim();
    const name = ensureName(argv.name);

    let { dockerHubUser, dockerHubPassword, gitHubAuthToken } = config;

    if (!owner) {
        throw new TypeError('GitHub namespace required, but is empty!');
    }

    if (!gitHubAuthToken) {
        throw new TypeError('Github auth token required, but was not given!');
    }

    const repo = `${owner}/${name}`;

    if (!dockerHubUser) {
        const answer: { dockerHubUser: string } = await inquirer.prompt<{
            dockerHubUser: string;
        }>([
            {
                type: 'input',
                name: 'dockerHubUser',
                message: 'Docker hub user:',
            },
        ] as QuestionCollection);

        if (!answer.dockerHubUser.trim()) {
            throw new TypeError(
                'DockerHub username required, but was not given!',
            );
        }

        dockerHubUser = answer.dockerHubUser;
    }

    if (!dockerHubPassword) {
        const answer: { dockerHubPassword: string } = await inquirer.prompt<{
            dockerHubPassword: string;
        }>([
            {
                type: 'password',
                name: 'dockerHubPassword',
                message: 'Docker hub password:',
            },
        ] as QuestionCollection);

        if (!answer.dockerHubPassword.trim()) {
            throw new TypeError(
                'DockerHub password required, but was not given!',
            );
        }

        dockerHubPassword = answer.dockerHubPassword;
    }

    console.log('Encrypting secrets...');

    try {
        return [
            await travisEncrypt(
                repo,
                `DOCKER_USER="${dockerHubUser}"`,
                argv.p ? gitHubAuthToken : undefined,
            ),
            await travisEncrypt(
                repo,
                `DOCKER_PASS="${dockerHubPassword}"`,
                argv.p ? gitHubAuthToken : undefined,
            ),
        ];
    } catch {
        // the CI encryption endpoint may be unavailable; never fail the whole
        // service creation over it - fall back to empty secrets and let the
        // user configure CI credentials manually
        console.log(
            styleText(
                'red',
                'Could not encrypt CI secrets (CI service unavailable). ' +
                    'Skipping - configure CI secrets manually if needed.',
            ),
        );

        return [];
    }
}

function stripDockerization(argv: any) {
    const path = resolve(argv.path as string);
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

async function enableTravisBuilds(argv: any) {
    console.log('Enabling travis builds...');
    let enabled = false;

    try {
        enabled = await enableBuilds(
            argv.u,
            ensureName(argv.name),
            config.gitHubAuthToken,
            argv.p,
        );
    } catch {
        /* ignore */
    }

    if (!enabled) {
        console.log(
            styleText(
                'red',
                'There was a problem enabling builds for this service. Please ' +
                    'go to http://travis-ci.org/ and enable builds manually.',
            ),
        );
    }
}

async function buildDockerCi(argv: any): Promise<void> {
    const dockerNs = await ensureDockerNamespace(argv);
    const dockerize = !!(
        gitRepoInitialized &&
        dockerNs &&
        (argv.D || config.useDocker)
    );

    // always define every docker/CI tag so template placeholders never leak
    // through as literal %DOCKER_* text, regardless of dockerization
    const tags: any = {
        TRAVIS_NODE_TAG: (await ensureTravisTags(argv))
            .map(t => `- ${t}`)
            .join('\n'),
        DOCKER_NAMESPACE: '',
        NODE_DOCKER_TAG: '',
        DOCKER_SECRETS: '',
    };

    if (!dockerize) {
        stripDockerization(argv);
    } else {
        console.log('Building docker <-> CI integration...');

        const secrets = await ensureDockerSecrets(argv);

        Object.assign(tags, {
            DOCKER_NAMESPACE: dockerNs,
            NODE_DOCKER_TAG: await ensureDockerTag(argv),
            DOCKER_SECRETS: secrets.length
                ? `- secure: ${secrets.join('\n  - secure: ')}`
                : '',
        });
    }

    // CI activation only makes sense once a repository exists, and must never
    // be fatal (the legacy CI service may be unreachable)
    if (gitRepoInitialized) {
        await enableTravisBuilds(argv);
    }

    console.log('Updating docker and CI configs...');
    compileTemplate(resolve(argv.path), tags);
}

async function buildTags(path: string, argv: any) {
    const name = ensureName(argv.name);
    const author = await ensureAuthorName(argv.author);
    const email = await ensureAuthorEmail(argv.email);
    const { home, bugs } = ensureServicePages(argv);
    const license = await ensureLicense(
        path,
        argv.license,
        author,
        email,
        home,
        name,
    );

    return {
        SERVICE_NAME: name,
        SERVICE_CLASS_NAME: camelCase(name),
        SERVICE_VERSION: ensureVersion(argv.serviceVersion),
        SERVICE_DESCRIPTION: ensureDescription(argv.description, name),
        SERVICE_REPO: ensureServiceRepo(argv.u, name),
        SERVICE_BUGS: bugs,
        SERVICE_HOMEPAGE: home,
        SERVICE_AUTHOR_NAME: author,
        SERVICE_AUTHOR_EMAIL: `<${email}>`,
        LICENSE_HEADER: license.header,
        LICENSE_TEXT: license.text,
        LICENSE_NAME: license.name,
        LICENSE_TAG: license.tag,
    };
}

function createServiceFile(path: string, tags: any) {
    console.log('Creating main service file...');

    touch(
        resolve(path, 'src', `${tags.SERVICE_CLASS_NAME}.ts`),
        `${tags.LICENSE_HEADER}
import { expose, IMQService, lock, logged, profile } from '@imqueue/rpc';

export class ${tags.SERVICE_CLASS_NAME} extends IMQService {
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

function createServiceTestFile(path: string, tags: any) {
    console.log('Creating main service test file...');

    touch(
        resolve(path, 'test/src', `${tags.SERVICE_CLASS_NAME}.ts`),
        `${tags.LICENSE_HEADER}
import { expect } from 'chai';
import { ${tags.SERVICE_CLASS_NAME} } from '../../src';


describe('${tags.SERVICE_CLASS_NAME}', () => {
    it('should be a class of IMQService', () => {
        expect(typeof ${tags.SERVICE_CLASS_NAME})
            .equals('function');
        expect(typeof (${tags.SERVICE_CLASS_NAME}.prototype as any).describe)
            .equals('function');
    });

    describe('version()', () => {
        const service = new ${tags.SERVICE_CLASS_NAME}();
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

function compileTemplateFile(text: string, tags: any): string {
    for (let tag of Object.keys(tags)) {
        text = text.replace(new RegExp(`%${tag}`, 'g'), tags[tag]);
    }

    return text;
}

function compileTemplate(path: string, tags: any) {
    fs.readdirSync(path).forEach((file: string) => {
        const filePath = resolve(path, file);

        if (fs.statSync(filePath).isDirectory()) {
            return compileTemplate(filePath, tags);
        }

        let content = compileTemplateFile(
            fs.readFileSync(filePath, { encoding: 'utf8' }),
            tags,
        );

        fs.writeFileSync(filePath, content, { encoding: 'utf8' });
    });
}

async function makeService(path: string, argv: any) {
    const tags = await buildTags(path, argv);

    compileTemplate(path, tags);
    createServiceFile(path, tags);
    createServiceTestFile(path, tags);
}

async function buildFromTemplate(argv: any) {
    const template = await ensureTemplate(argv.template);
    const path = resolve(argv.path);

    console.log(`Building service from template "${template}"...`);

    cpr(template, path);
    await makeService(path, argv);
}

async function ensureGitRepo(argv: any) {
    if (!isNamespace(argv.u)) {
        const answer: { gitNs: string } = await inquirer.prompt<{
            gitNs: string;
        }>([
            {
                type: 'input',
                name: 'gitNs',
                message: 'Enter GitHub owner (user name or organization):',
            },
        ] as QuestionCollection);

        if (!isNamespace(answer.gitNs)) {
            throw new TypeError(
                `Given github namespace "${argv.u}" is invalid!`,
            );
        }

        argv.u = answer.gitNs;
    }

    return argv.u + '/' + dashed(argv.name);
}

let gitRepoInitialized = false;

async function createGitRepo(argv: any) {
    let useGit = argv.g || config.useGit;

    if (!useGit && typeof config.useGit === 'undefined') {
        const answer: { useGit: boolean } = await inquirer.prompt<{
            useGit: boolean;
        }>([
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

    // respect an explicit "no" (from prompt or a stored config.useGit === false)
    if (!useGit) {
        // git integration disabled - dockerization depends on a pushed repo
        argv.D = argv.dockerize = config.useDocker = false;
        return;
    }

    const url = await ensureGitRepo(argv);
    let token = (argv.T || '').trim() || config.gitHubAuthToken;

    if (!isGithubToken(token)) {
        const answer: { token: string } = await inquirer.prompt<{
            token: string;
        }>([
            {
                type: 'input',
                name: 'token',
                message: 'Enter your GitHub auth token:',
            },
        ] as QuestionCollection);

        if (!isGithubToken(answer.token.trim())) {
            throw new Error('Given GitHub auth token is invalid!');
        }

        config.gitHubAuthToken =
            argv.T =
            argv.githubToken =
            token =
                answer.token.trim();
    }

    let isPrivate = argv.p || config.gitRepoPrivate;

    if (!isPrivate && typeof config.gitRepoPrivate === 'undefined') {
        const answer: { isPrivate: boolean } = await inquirer.prompt<{
            isPrivate: boolean;
        }>([
            {
                type: 'confirm',
                name: 'isPrivate',
                message: 'Should be service created on GitHub as private repo?',
                default: true,
            },
        ] as QuestionCollection);

        isPrivate = answer.isPrivate;
    }

    argv.p = argv.private = config.gitRepoPrivate = isPrivate;

    const descr = ensureDescription(argv.description, ensureName(argv.name));

    console.log('Creating github repository...');
    await createRepository(url, token, descr, isPrivate);

    gitRepoInitialized = true;
}

async function installPackages(argv: any) {
    if (!commandExists('npm')) {
        throw new Error('npm command is not installed!');
    }

    const servicePath = resolve(argv.path);

    // install exactly what the template's package.json declares, preserving
    // its tested version ranges instead of pulling "latest" of everything
    console.log('Installing dependencies...');
    execFileSync('npm', ['install'], {
        cwd: servicePath,
        stdio: 'inherit',
    });
}

async function commit(argv: any) {
    const servicePath = resolve(argv.path);
    const name = ensureName(argv.name);
    const owner = (argv.u || '').trim();
    const pkg: any = require(resolve(servicePath, 'package.json'));
    let url = config.gitBaseUrl;

    if (!owner && !url) {
        throw new TypeError('GitHub namespace missing!');
    } else if (owner) {
        url = `git@github.com:${owner}/${name}.git`;
    } else {
        url += `/${name}.git`;
    }

    if (!commandExists('git')) {
        throw new Error('Git command expected, but is not installed!');
    }

    // run git via arg arrays (no shell) so urls/branches can't be injected
    const git = (...args: string[]) =>
        execFileSync('git', args, { cwd: servicePath, stdio: 'inherit' });
    const tag = `v${pkg.version}`;

    console.log('Committing changes...');
    git('init');
    git('add', '.');
    git('commit', '-am', 'Initial commit');

    // honor the repo's configured default branch instead of assuming "master"
    const branch =
        execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
            cwd: servicePath,
        })
            .toString()
            .trim() || 'main';

    git('remote', 'add', 'origin', url);
    git('push', 'origin', branch);

    console.log('Setting up version tag...');

    try {
        git('tag', '-d', tag);
    } catch {
        /* no local tag to drop */
    }

    try {
        git('push', 'origin', `:refs/tags/${tag}`);
    } catch {
        /* no remote tag to drop */
    }

    git('tag', '-fa', tag, '-m', `Tagging version ${tag}`);
    git('push', 'origin', branch, '--tags');
}

export const { command, describe, builder, handler } = {
    command: 'create [name] [path]',
    describe:
        'Creates new service package with the given service name ' +
        'under given path.',

    builder(yargs: Argv) {
        config = loadConfig();

        return yargs
            .alias('a', 'author')
            .describe('a', 'Service author full name (person or organization)')
            .default('a', config.author || '')

            .alias('e', 'email')
            .describe('e', "Service author's contact email")
            .default('e', config.email || '')

            .alias('g', 'use-git')
            .describe('g', 'Turns on automatic git repo creation')
            .boolean('g')

            .alias('u', 'github-namespace')
            .describe(
                'u',
                'GitHub namespace (usually user name or ' +
                    'organization name)',
            )
            .default('u', (config.gitBaseUrl || '').split(':').pop() || '')

            .describe(
                'no-install',
                'Do not install npm packages ' +
                    'automatically on service creation',
            )
            .boolean('no-install')
            .default('no-install', false)

            .alias('V', 'service-version')
            .describe('V', 'Initial service version')
            .default('V', DEFAULT_SERVICE_VERSION)

            .alias('H', 'homepage')
            .describe('H', 'Homepage URL for service, if required')
            .default('H', '')

            .alias('B', 'bugs-url')
            .describe('B', 'Bugs url for service, if required')
            .default('B', '')

            .alias('l', 'license')
            .describe(
                'l',
                'License for created service, should be either ' +
                    'license name in SPDX format or path to a custom license file',
            )
            .default('l', config.license || 'UNLICENSED')

            .alias('t', 'template')
            .describe(
                't',
                'Template used to create service (should be ' +
                    'either template name, git url or file system directory)',
            )
            .default('t', config.template || 'default')

            .alias('d', 'description')
            .describe('d', 'Service description')
            .default('d', '')

            .alias('n', 'node-versions')
            .describe(
                'n',
                'Node version tags to use for builds, separated ' +
                    'by comma if multiple. First one will be used for docker ' +
                    'build, if dockerize option enabled.',
            )
            .default('n', '')

            .alias('D', 'dockerize')
            .describe('D', 'Enable service dockerization with CI builds')
            .boolean('D')

            .alias('L', 'node-docker-tag')
            .describe(
                'L',
                'Node docker tag to use as base docker image ' +
                    'for docker builds',
            )
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

            .default('name', path.basename(process.cwd()))
            .describe('name', 'Service name to create with')

            .default('path', '.')
            .describe(
                'path',
                'Path to directory where service will be generated to',
            );
    },

    async handler(argv: any) {
        const servicePath = resolve(argv.path);
        // remember whether the target existed before this run so a failure
        // never deletes a directory we did not create
        const preExisted = fs.existsSync(servicePath);

        try {
            await buildFromTemplate(argv);
            await createGitRepo(argv);
            await buildDockerCi(argv);

            if (!argv.noInstall) {
                await installPackages(argv);
            }

            if (gitRepoInitialized) {
                await commit(argv);
            }

            console.log(styleText('green', 'Service successfully created!'));
        } catch (err) {
            // only remove the directory when this command created it, and
            // never the current working directory or the user's home
            if (
                !preExisted &&
                servicePath !== resolve('.') &&
                servicePath !== OS_HOME
            ) {
                rmdir(servicePath);
            }

            printError(err as Error);
        }
    },
};
