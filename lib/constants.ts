/*!
 * IMQ-CLI library: constants
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
import { resolve } from './path';

export const OS_HOME: string = os.homedir() || String(process.env['HOME']);
export const IMQ_HOME = '~/.imq';
export const TPL_REPO = 'git@github.com:imqueue/templates.git';
export const TPL_HOME = resolve(IMQ_HOME, 'templates');
export const CUSTOM_TPL_HOME = resolve(IMQ_HOME, 'custom-templates');
export const CONFIG_FILENAME = 'config.json';
export const CONFIG_PATH = resolve(IMQ_HOME, CONFIG_FILENAME);
export const IS_ZSH = Object.keys(process.env).some(key => /^ZSH/.test(key));
export const VERSION = require(`${__dirname}/../package.json`).version;
