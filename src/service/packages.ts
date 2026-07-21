/*!
 * IMQ-CLI command: service packages
 *
 * I'm Queue Software Project
 * Copyright (C) 2026  imqueue.com <support@imqueue.com>
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
import { type Argv, type Arguments } from 'yargs';
import { printError } from '../../lib/index.js';
import { loadCatalog } from '../catalog/load.js';

export const { command, describe, builder, handler } = {
    command: 'packages',
    describe:
        'Lists the @imqueue addon packages available to `service create` ' +
        '(the --packages option).',

    builder(yargs: Argv) {
        return yargs.option('j', {
            alias: 'json',
            boolean: true,
            default: false,
            describe: 'Print the catalog as JSON',
        });
    },

    handler(argv: Arguments) {
        try {
            const catalog = loadCatalog();

            if ((argv as any).json) {
                process.stdout.write(
                    JSON.stringify(catalog.packages, null, 2) + '\n',
                );

                return;
            }

            // group ids -> entries, so the exclusive/free grouping is visible
            const byGroup = new Map<string, string[]>();

            for (const [id, entry] of Object.entries(catalog.packages)) {
                const line =
                    styleText('cyan', id) +
                    (entry.title ? ` - ${entry.title}` : '');

                const list = byGroup.get(entry.group) || [];

                list.push(line);
                byGroup.set(entry.group, list);
            }

            for (const [groupId, entries] of byGroup) {
                const group = catalog.groups[groupId];
                const title = group?.title || groupId;
                const kind = group?.exclusive
                    ? ' (pick at most one)'
                    : ' (any number)';

                process.stdout.write(
                    '\n' + styleText(['bold', 'green'], title + kind) + '\n',
                );

                for (const entry of entries) {
                    process.stdout.write('  ' + entry + '\n');
                }
            }

            process.stdout.write(
                '\n' +
                    'Use with: ' +
                    styleText('cyan', 'imq service create … --packages a,b') +
                    '\n',
            );
        } catch (err) {
            printError(err as Error);
        }
    },
};
