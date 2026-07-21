/*!
 * @imqueue/cli library: license
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
import inquirer from 'inquirer';
import autocompletePrompt from 'inquirer-autocomplete-prompt';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

(<any>inquirer).registerPrompt('autocomplete', autocompletePrompt);

const LICENSES: any = require('./licenses.json');

const RX_ESCAPE = /[-[\]/{}()*+?.\\^$|]/g;

/**
 * Finds and returns license object by a given name pattern
 *
 * @param {string} name
 * @return {any}
 */
export function findLicense(name: string): any {
    // escape regex metacharacters so inputs like "c++" or a file path can't
    // produce an invalid pattern or match unintended entries
    const escaped = name.toLowerCase().replace(RX_ESCAPE, '\\$&');
    const rx = new RegExp(`^${escaped}`, 'i');

    for (let id of Object.keys(LICENSES)) {
        if (
            name === id ||
            name.toLowerCase() === id ||
            rx.test(LICENSES[id].spdx_id)
        ) {
            return LICENSES[id];
        }
    }

    for (let id of Object.keys(LICENSES)) {
        if (rx.test(LICENSES[id].name)) {
            return LICENSES[id];
        }
    }

    return null;
}

/**
 * Queries user for license selection
 *
 * @return {Promise<{id: string; name: string}>}
 */
export async function licensingOptions(): Promise<{
    id: string;
    name: string;
}> {
    let answer: any = await (<any>(inquirer as any).prompt)([
        {
            type: 'confirm',
            name: 'addLicense',
            message:
                'Would you like to use specific license for your services?',
            default: true,
        },
    ]);
    let licenseName = 'UNLICENSED';

    if (!answer.addLicense) {
        return { id: licenseName, name: licenseName };
    }

    const licenses: string[] = Object.keys(LICENSES).map(
        (id: string) => LICENSES[id],
    );

    answer = await (<any>(inquirer as any).prompt)([
        {
            type: 'autocomplete',
            name: 'licenseName',
            message: 'Select license:',
            source: async (answers: any, input: string) => {
                return licenses
                    .filter((license: any) => {
                        let rx = new RegExp(
                            `^${(input || '').replace(RX_ESCAPE, '\\$&')}`,
                            'i',
                        );

                        return license.key.match(rx) || license.name.match(rx);
                    })
                    .map((license: any) => (license && license.name) || '');
            },
        },
    ]);

    const license: any = licenses.find(
        (license: any) => license.name === answer.licenseName,
    );

    if (license) {
        licenseName = license.name;
    }

    return { id: license.spdx_id, name: licenseName };
}
