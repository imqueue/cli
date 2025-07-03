/*!
 * IMQ-CLI command: completions on
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
import { Argv } from 'yargs';
import {
    existsSync as exists,
    appendFileSync as append,
    readFileSync as read
} from 'fs';
import { resolve, touch, printError, IS_ZSH } from '../../lib';
import chalk from 'chalk';

let PROGRAM: string = '';
let RX_EXISTS: RegExp;

// istanbul ignore next
/**
 * Prints add script success message to user
 *
 * @access private
 * @param {string} rcFilename - path to shell rc file modified
 */
function printAdded(rcFilename: string) {
    process.stdout.write(
        chalk.green(`Completion script added to `) +
        chalk.cyan(rcFilename) + '\n' +
        'To have these changes to take effect, please, run:\n\n' +
        '  $ ' + chalk.cyan(`source ${rcFilename}`) + '\n\n'
    );
}

// istanbul ignore next
/**
 * Returns completions script for user's shell
 *
 * @param {string} zshScript - zsh based script part
 * @return {string}
 */
function getScript(zshScript: string) {
        return `
###-begin-${PROGRAM}-completions-###
${zshScript}
_yargs_completions() {
	local cur_word args type_list
	cur_word="\${COMP_WORDS[COMP_CWORD]}"
	args=("\${COMP_WORDS[@]}")
	type_list=$(${PROGRAM} --get-yargs-completions "\${args[@]}")
	COMPREPLY=( $(compgen -W "\${type_list}" -- \${cur_word}) )
	if [ \${#COMPREPLY[@]} -eq 0 ]; then
		COMPREPLY=( $(compgen -f -- "\${cur_word}" ) )
	fi
	return 0
}
complete -F _yargs_completions ${PROGRAM}
###-end-${PROGRAM}-completions-###\n`;
}

// istanbul ignore next
/**
 * Prints script exists message to the user
 *
 * @param {string} rcFilename - path to shell rc file containing script
 */
function printExists(rcFilename: string) {
    process.stdout.write(
        chalk.yellow.bold(
            `Completion script already exists in your ${
                rcFilename}.`) + '\n' +
        'If it does not work, please try one of:\n\n' +
        chalk.cyan('  1. Reload your shell\n') +
        chalk.cyan(`  2. Run source ${rcFilename}\n\n`)
    );
}

// noinspection JSUnusedGlobalSymbols
export const { command, describe, builder, handler } = {
    command: 'on',
    describe: 'Enables completions for this program in your shell',

    async builder(yargs: Argv) {
        PROGRAM = (await yargs.argv).$0;
        RX_EXISTS = new RegExp(`###-begin-${PROGRAM}-completions-###`);
    },

    handler() {
        try {
            const zScript = IS_ZSH ? 'autoload bashcompinit\nbashcompinit' : '';
            const rcFilename = IS_ZSH ? '~/.zshrc' : '~/.bashrc';
            const rcFile = resolve(rcFilename);
            const rcText = read(rcFile, { encoding: 'utf8' });

            if (!RX_EXISTS.test(rcText)) {
                (exists(rcFile) ? append : touch)(rcFile, getScript(zScript));
                printAdded(rcFilename);
            }

            else {
                printExists(rcFilename);
            }
        }

        catch (err) {
            printError(err);
        }
    }
};
