#!/usr/bin/env node
/*!
 * I Message Queue Command Line Interface
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
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { VERSION, checkForUpdate } from './lib';

(async () => {
    const y = yargs(hideBin(process.argv));

    await checkForUpdate();

    await y.usage('IMQ Command Line Interface' +
            `\nVersion: ${VERSION}` +
            '\n\nUsage: $0 <command>')
        .version(VERSION)
        .commandDir('src')
        .demandCommand()
        .wrap(y.terminalWidth())
        .help()
        .argv
    ;
})();
