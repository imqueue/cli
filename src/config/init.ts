/*!
 * IMQ-CLI command: config init
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
import * as inquirer from 'inquirer';
import {
    CONFIG_PATH,
    TPL_HOME,
    CUSTOM_TPL_HOME,
    TPL_REPO,
    loadConfig,
    saveConfig,
    configEmpty,
    printError,
    IMQCLIConfig,
    resolve,
    rmdir
} from '../../lib';
import chalk from 'chalk';
import * as fs from 'fs';
import { execSync } from 'child_process';

const commandExists = require('command-exists').sync;

inquirer.registerPrompt(
    'autocomplete',
    require('inquirer-autocomplete-prompt')
);

// we are going to ignore almost all code here because it's very hard to test
// command line user interaction
// istanbul ignore next
export function checkGit() {
    if (!commandExists('git')) {
        throw new Error('Git required but is not installed!');
    }
}

// istanbul ignore next
export async function loadTemplates() {
    if (fs.existsSync(TPL_HOME)) {
        await updateTemplates();
    }

    else {
        checkGit();
        console.log('Loading IMQ templates, please, wait...');
        execSync(`git clone ${TPL_REPO} ${TPL_HOME}`);
    }

    return fs.readdirSync(TPL_HOME).reduce((res: any, next: any) => {
        const path = resolve(TPL_HOME, next);

        if (/^\./.test(next)) return res;

        if (fs.statSync(path).isDirectory()) {
            res[next] = path;
        }

        return res;
    }, {});
}

// istanbul ignore next
export async function updateTemplates() {
    const cwd = process.cwd();

    process.chdir(TPL_HOME);
    checkGit();

    console.log('Updating IMQ templates, please, wait...');

    execSync('git pull');
    process.chdir(cwd);
}

// istanbul ignore next
export async function loadTemplate(url: string): Promise<string> {
    const name = (url.split(/[\/]/).pop() || '').replace(/\.git$/, '');
    const path = resolve(CUSTOM_TPL_HOME, name);

    if (fs.existsSync(path)) {
        let answer = await inquirer.prompt<{ overwrite: boolean }>([{
            type: 'confirm',
            name: 'overwrite',
            message: 'Seems such template was already loaded, would you like ' +
                'to fetch it again and overwrite?',
            default: false
        }]);

        if (!answer.overwrite) {
            return path;
        }

        rmdir(path);
    }

    console.log(`Loading template from repository ${url}, please, wait...`);
    execSync(`git clone ${url} ${path}`);

    return path;
}

// istanbul ignore next
export async function selectTemplate(
    type: string
): Promise<{
    [name: string]: string
}> {
    let name = 'custom';
    let path = '';

    if (type === 'existing') {
        const defaultTemplates = await loadTemplates();
        let answer = await inquirer.prompt<{ tplName: string }>([{
            type: 'list',
            name: 'tplName',
            message: 'Select one of existing templates:',
            choices: Object.keys(defaultTemplates)
        }]);

        return { [answer.tplName] : defaultTemplates[answer.tplName] };
    }

    if (type === 'repo') {
        let answer = await inquirer.prompt<{ repoUrl: string }>([{
            type: 'input',
            name: 'repoUrl',
            message: 'Enter git repository URL:'
        }]);

        if (!(answer.repoUrl && answer.repoUrl.trim())) {
            throw new TypeError('Repository URL expected, but was not given!');
        }

        path = await loadTemplate(answer.repoUrl);
    }

    else if (type === 'directory') {
        let answer = await inquirer.prompt<{ tplDir: string }>([{
            type: 'input',
            name: 'tplDir',
            message: 'Enter path to directory:'
        }]);

        if (!(answer.tplDir && answer.tplDir.trim())) {
            throw new TypeError('Template directory path expected, ' +
                'but was not given!');
        }

        if (!fs.existsSync(resolve(answer.tplDir))) {
            throw new Error('Given template directory does not exist!');
        }

        path = resolve(answer.tplDir);
    }

    return { [name]: path };
}

// istanbul ignore next
export async function templateOptions(config: IMQCLIConfig) {
    let answer: any = await inquirer.prompt<{ useDefault: boolean }>(
        [{
            type: 'confirm',
            name: 'useDefault',
            message: 'Do you want to use default template for newly created ' +
                'services?',
            default: true
        }]
    );
    let templates;
    let tplName = 'default';

    if (!answer.useDefault) {
        answer = await inquirer.prompt<{ tplType: string }>(
            [{
                type: 'list',
                name: 'tplType',
                message: 'Select required template:',
                choices: [{
                    name: 'From a list of existing templates',
                    value: 'existing'
                }, {
                    name: 'From a git repository',
                    value: 'repo'
                }, {
                    name: 'From file system directory',
                    value: 'directory'
                }]
            }]
        );

       templates =  await selectTemplate(answer.tplType);
       tplName  = Object.keys(templates).shift() || '';
    }

    else {
        templates = await loadTemplates();
    }

    if (templates[tplName]) {
        config.template = templates[tplName];
        return console.log(chalk.green(
            `New services set to be created from template "${
                tplName}" (${config.template})`
        ));
    }

    else {
        throw new Error(`Template ${tplName} does not exists!`);
    }

}

// istanbul ignore next
export async function versionSystemOptions(config: IMQCLIConfig) {

}

const RX_ESCAPE = /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g;

// istanbul ignore next
export async function licensingOptions(config: IMQCLIConfig) {
    let answer: any = await inquirer.prompt<{ addLicense: boolean }>([{
        type: 'confirm',
        name: 'addLicense',
        message: 'Would you like to use specific license for your services?',
        default: true
    }]);
    let licenseName = 'UNLICENSED';

    if (!answer.addLicense) {
        config.license = licenseName;
        return ;
    }

    let licenses: any = require('../../lib/licenses.json');
    licenses = Object.keys(licenses).map((id: string) => licenses[id]);

    answer = await (<any>inquirer.prompt)([{
        type: 'autocomplete',
        name: 'licenseName',
        message: 'Select license:',
        source: async (answers: any, input: string) => {
            return licenses.filter((license: any) => {
                let rx = new RegExp(
                    `^${(input || '').replace(RX_ESCAPE, "\\$&")}`, 'i'
                );

                return license.key.match(rx) || license.name.match(rx);
            }).map((license: any) => license && license.name || '');
        }
    }]);

    const license = licenses.find((license: any) =>
        license.name === answer.licenseName);

    if (license) {
        config.license = license.spdx_id;
        licenseName = license.name;
    }

    console.log(chalk.green(
        `Selected "${
            licenseName
        }" to be a license for IMQ generated code and services`
    ));
}

// istanbul ignore next
export async function authorName(config: IMQCLIConfig): Promise<void> {
    const answer = await inquirer.prompt<{ author: string }>([{
        type: 'input',
        name: 'author',
        message: 'Enter author\'s full name (user or organization):'
    }]);

    if (!answer.author.trim()) {
        console.log(chalk.red(`Given name is invalid, please, try again.`));
        return await authorName(config);
    }

    config.author = answer.author;

    console.log(chalk.green(
        `Auto-generated code will be authored by "${config.author}"`
    ));
}

// istanbul ignore next
export async function authorEmail(config: IMQCLIConfig) {
    const answer = await inquirer.prompt<{ email: string }>([{
        type: 'input',
        name: 'email',
        message: 'Enter user or organization email:'
    }]);

    if (!/^[-a-z0-9.]+@[-a-z0-9.]+$/i.test(answer.email)) {
        console.log(chalk.red(`Given email is invalid, please, try again.`));
        return await authorName(config);
    }

    config.email = answer.email;

    console.log(chalk.green(
        `Generated code will be referred to given contact: ${config.email}`
    ));
}

// istanbul ignore next
export async function authorOptions(config: IMQCLIConfig) {
    await authorName(config);
    await authorEmail(config);
}

// istanbul ignore next
export async function serviceQuestions(config: IMQCLIConfig) {
    await authorOptions(config);
    await templateOptions(config);
    await licensingOptions(config);
    await versionSystemOptions(config);
}

// istanbul ignore next
export async function clientQuestions(config: IMQCLIConfig) {

}

// noinspection JSUnusedGlobalSymbols
export const { command, describe, handler } = {
    command: 'init',
    describe: 'Interactively initializes IMQ CLI configuration file',

    async handler() {
        try {
            if (!configEmpty()) {
                process.stdout.write(
                    chalk.bold.yellow('Config already initialized, path: ') +
                    chalk.cyan(CONFIG_PATH) + '\n'
                );

                const answer: any = await inquirer.prompt<{ reInit: boolean }>(
                    [{
                        type: 'confirm',
                        name: 'reInit',
                        message: 'Do you want to re-init?',
                        default: false
                    }]
                );

                if (!answer.reInit) {
                    return;
                }
            }

            process.stdout.write(
                chalk.cyan('You are going to define global config options ' +
                    'for IMQ CLI runs.\nThese options will be used as ' +
                    'default parameters and will help\nyou shorten your ' +
                    'commands.\nBy the way you will be able to override ' +
                    'default options any\ntime running the exact command and ' +
                    'provide them separately.\n\n')
            );

            const config = loadConfig();

            await serviceQuestions(config);
            await clientQuestions(config);

            saveConfig(config);
        }

        catch (err) {
            printError(err);
            console.error(err);
        }
    }
};
