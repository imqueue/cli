/*!
 * IMQ-CLI library: license
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
import * as inquirer from 'inquirer';

inquirer.registerPrompt(
    'autocomplete',
    require('inquirer-autocomplete-prompt')
);

const LICENSES: any = require('./licenses.json');

// noinspection RegExpRedundantEscape
const RX_ESCAPE = /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g;

/**
 * Finds and returns license object by a given name pattern
 *
 * @param {string} name
 * @return {any}
 */
export function findLicense(name: string): any {
    for (let id of Object.keys(LICENSES)) {
        if (name === id ||
            name.toLowerCase() === id ||
            new RegExp(`^${name.toLowerCase()}`, 'i')
                .test(LICENSES[id].spdx_id)
        ) {
            return LICENSES[id];
        }
    }

    for (let id of Object.keys(LICENSES)) {
        if (new RegExp(`^${name.toLowerCase()}`, 'i')
            .test(LICENSES[id].name)
        ) {
            return LICENSES[id];
        }
    }

    return null;
}

// istanbul ignore next
/**
 * Queries user for license selection
 *
 * @return {Promise<{id: string; name: string}>}
 */
export async function licensingOptions(): Promise<{
    id: string,
    name: string
}> {
    let answer: any = await inquirer.prompt<{ addLicense: boolean }>([{
        type: 'confirm',
        name: 'addLicense',
        message: 'Would you like to use specific license for your services?',
        default: true
    }]);
    let licenseName = 'UNLICENSED';

    if (!answer.addLicense) {
        return { id: licenseName, name: licenseName };
    }

    const licenses: string[] = Object.keys(LICENSES)
        .map((id: string) => LICENSES[id]);

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

    const license: any = licenses.find((license: any) =>
        license.name === answer.licenseName);

    if (license) {
        licenseName = license.name;
    }

    return { id: license.spdx_id, name: licenseName };
}