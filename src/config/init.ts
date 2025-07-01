/*!
 * IMQ-CLI command: config init
 *
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
 */
import * as inquirer from 'inquirer';
import {
    CONFIG_PATH,
    loadConfig,
    saveConfig,
    configEmpty,
    printError,
    IMQCLIConfig,
    resolve,
    wrap,
    loadTemplates,
    loadTemplate,
    licensingOptions,
} from '../../lib';
import * as chalk from 'chalk';
import * as fs from 'fs';

// we are going to ignore almost all code here because it's very hard to test
// command line user interaction
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
export async function versionSystemOptions(
    config: IMQCLIConfig
): Promise<void> {
    let answer: any = await inquirer.prompt<{ autoCreateRepo: boolean }>([{
        type: 'confirm',
        name: 'autoCreateRepo',
        message: 'Would you like IMQ automatically create git ' +
            'repository for new services when generate?',
        default: true,
    }]);

    if (!answer.autoCreateRepo) {
        config.useGit = false;
        return ;
    }

    config.useGit = true;

    console.log(chalk.cyan(
        wrap('\nTo publish git repository you need to provide base url ' +
            'where your git repositories published to. It is recommended ' +
            'also to set-up git SSH access on your machine to ' +
            'make publishing process run smoothly.\n\nFor example, if ' +
            'you are using GitHub for your repositories, you need to enter ' +
            'git@github.com:[user_or_org] as base URL and setup SSH ' +
            'access as described at https://help.github.com/articles/' +
            'adding-a-new-ssh-key-to-your-github-account/\n')
    ));

    answer = await inquirer.prompt<{ url: string }>([{
        type: 'input',
        name: 'url',
        message: 'Enter github organization or user name:',
    }]);

    if (!/^[-_a-z0-9]+$/i.test(answer.url)) {
        console.log(chalk.red('Wrong user or organization name.'));
        return await versionSystemOptions(config);
    }

    config.gitBaseUrl = `git@github.com:${answer.url}`;

    console.log(chalk.green(`Base git URL is set to "${config.gitBaseUrl}"`));

    answer = await inquirer.prompt<{ saveGitHubToken: boolean }>([{
        type: 'confirm',
        name: 'saveGitHubToken',
        message: 'Would you like to save GitHub auth token in a local config ' +
            'to prevent imq to ask it any time service is created?',
        default: false,
    }]);

    if (!answer.saveGitHubToken) {
        return ;
    }

    console.log(chalk.cyan(wrap(
        'To make GitHub integration work you must provide a valid token ' +
        'which grants permission to create repository for a specified ' +
        'organization or user name.\nUsually you can generate the token ' +
        'on this page: https://github.com/settings/tokens'
    )));

    answer = await inquirer.prompt<{ gitHubAuthToken: string }>([{
        type: 'input',
        name: 'gitHubAuthToken',
        message: 'Enter GitHub auth token:',
    }]);

    if (!answer.gitHubAuthToken.trim()) {
        console.log(chalk.red(
            'Given token is empty, you will be prompted to enter it on ' +
            'service create command'
        ));

        return ;
    }

    config.gitHubAuthToken = answer.gitHubAuthToken.trim();

    console.log(chalk.green('GitHub auth token stored in local config file'));

    answer = await inquirer.prompt<{ isPrivate: boolean }>([{
        type: 'confirm',
        name: 'isPrivate',
        message: 'Does created service should a private repository on GitHub?',
        default: true,
    }]);

    config.gitRepoPrivate = answer.isPrivate;

    console.log(chalk.green(
        `Service on GitHub will be created as ${config.gitRepoPrivate ?
            'private' : 'public'} repository.`
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

    config.author = answer.author.trim();

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

    if (!/^[-a-z0-9.]+@[-a-z0-9.]+$/i.test(answer.email.trim())) {
        console.log(chalk.red(`Given email is invalid, please, try again.`));
        return await authorName(config);
    }

    config.email = answer.email.trim();

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
export async function dockerCredentials(config: IMQCLIConfig): Promise<void> {
    const answer = await inquirer.prompt<{
        dockerHubUser: string,
        dockerHubPassword: string
    }>([{
        type: 'input',
        name: 'dockerHubUser',
        message: 'Docker hub user:'
    }, {
        type: 'password',
        name: 'dockerHubPassword',
        message: 'Docker hub password:'
    }]);

    if (!answer.dockerHubUser.trim()) {
        console.log(chalk.red(
            'Given docker hub user name is empty, please try again'
        ));
        return dockerCredentials(config);
    }

    if (!answer.dockerHubPassword.trim()) {
        console.log(chalk.red(
            'Given docker hub password is empty, please try again'
        ));
        return dockerCredentials(config);
    }

    config.dockerHubUser = answer.dockerHubUser.trim();
    config.dockerHubPassword = answer.dockerHubPassword.trim();

    console.log(chalk.green(
        'Docker hub credentials saved in a local config file.'
    ));
}

// istanbul ignore next
export async function dockerQuestions(config: IMQCLIConfig): Promise<void> {
    let answer: any = await inquirer.prompt<{ useDocker: boolean }>([{
        type: 'confirm',
        name: 'useDocker',
        message: 'Would you like to dockerize created imq services?',
        default: true
    }]);

    if (!answer.useDocker) {
        config.useDocker = false;
        return ;
    }

    answer = await inquirer.prompt<{ dockerHubNamespace: string }>([{
        type: 'input',
        name: 'dockerHubNamespace',
        message: 'Docker hub namespace:'
    }]);

    if (!answer.dockerHubNamespace.trim()) {
        console.log(chalk.red(
            'Given docker hub namespace is invalid, please, try again...'
        ));
        return await dockerQuestions(config);
    }

    config.useDocker = true;
    config.dockerHubNamespace = answer.dockerHubNamespace.trim();

    answer = await inquirer.prompt<{ saveDockerCredentials: boolean }>([{
        type: 'confirm',
        name: 'saveDockerCredentials',
        message: 'Would you like to store docker credentials locally to ' +
            'allow imq create CI-Docker secrets without prompt?',
        default: false
    }]);

    if (!answer.saveDockerCredentials) {
        return ;
    }

    await dockerCredentials(config);
}

// istanbul ignore next
export async function serviceQuestions(config: IMQCLIConfig) {
    await authorOptions(config);
    await templateOptions(config);

    const { id, name } = await licensingOptions();
    config.license = id;

    console.log(chalk.green(
        `Selected "${name}" to be a license for IMQ generated code and services`
    ));

    await versionSystemOptions(config);
    await dockerQuestions(config);
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

            console.log(chalk.cyan(wrap(
                'Let\'s define global config options ' +
                'for IMQ command line runs. These options will be used as ' +
                'default parameters and will help you shorten your ' +
                'commands.\n\n'
            )));

            console.log(chalk.yellow(wrap(
                '- You can skip this step by pressing ' +
                '[^C].\n- You can proceed to this step later by running:'
            )));
            console.log(chalk.magenta('\n  $ imq config init\n'));

            const config = loadConfig();

            await serviceQuestions(config);
            saveConfig(config);

            console.log(chalk.magenta('IMQ-CLI successfully configured!'));
        }

        catch (err) {
            printError(err);
            console.error(err);
        }
    }
};
