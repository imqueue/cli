/*!
 * IMQ-CLI library: constants
 *
 * Copyright (c) 2018, imqueue.com <support@imqueue.com>
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
