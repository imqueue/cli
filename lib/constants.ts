/*!
 * @imqueue/cli library: constants
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
import * as os from 'os';
import { resolve } from './path.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// IMQ_CLI_HOME allows tests (or callers) to sandbox all cli file locations
export const OS_HOME: string =
    process.env.IMQ_CLI_HOME ||
    os.homedir() ||
    process.env['HOME'] ||
    os.tmpdir();
export const IMQ_HOME = '~/.imq';
// default to public HTTPS so users without an SSH key can fetch templates;
// overridable (e.g. SSH for contributors, or a fork)
export const TPL_REPO =
    process.env.IMQ_TEMPLATES_REPO ||
    'https://github.com/imqueue/templates.git';
export const TPL_HOME = resolve(IMQ_HOME, 'templates');
export const CUSTOM_TPL_HOME = resolve(IMQ_HOME, 'custom-templates');
// runtime working directory - holds per-service logs and the process id file
// used by `imq ctl` / `imq log` (was `$HOME/.imq/var` in the legacy bash tools)
export const VAR_HOME = resolve(IMQ_HOME, 'var');
export const CONFIG_FILENAME = 'config.json';
export const CONFIG_PATH = resolve(IMQ_HOME, CONFIG_FILENAME);
// detect zsh from the actual login shell rather than any ZSH* env var, which
// tools like oh-my-zsh export (and bash subshells then inherit)
export const IS_ZSH =
    !!process.env['ZSH_VERSION'] ||
    (process.env['SHELL'] || '').endsWith('zsh');
export const VERSION = require(
    `${import.meta.dirname}/../package.json`,
).version;
