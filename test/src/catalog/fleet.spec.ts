/*!
 * @imqueue/cli catalog: fleet analysis tests
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
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// IMQ_CLI_HOME reroutes every path the CLI writes, the analysis cache included,
// so it has to be set BEFORE the modules under test resolve their constants.
const SANDBOX = mkdtempSync(join(tmpdir(), 'imq-fleet-home-'));

process.env.IMQ_CLI_HOME = SANDBOX;

const {
    analyseFleet,
    fleetCachePath,
    fleetOrmDefaults,
    fleetOrmNote,
    recordOrmChoice,
} = await import('../../../src/catalog/fleet.js');

/** Writes a service directory with the given dependencies. */
function service(root: string, name: string, deps: string[]): void {
    mkdirSync(join(root, name), { recursive: true });
    writeFileSync(
        join(root, name, 'package.json'),
        JSON.stringify({
            name,
            dependencies: Object.fromEntries(deps.map(d => [d, '*'])),
        }),
    );
}

const RPC = '@imqueue/rpc';
const SEQ = '@imqueue/sequelize';
const PRISMA = '@imqueue/pg-prisma';

describe('analyseFleet()', () => {
    const fleets: string[] = [];

    function fleet(): string {
        const dir = mkdtempSync(join(tmpdir(), 'imq-fleet-'));

        fleets.push(dir);

        return dir;
    }

    before(() => rmSync(fleetCachePath(), { force: true }));
    after(() => {
        for (const dir of fleets) {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('reads a Sequelize fleet as sequelize', () => {
        const root = fleet();

        service(root, 'auth', [RPC, SEQ]);
        service(root, 'billing', [RPC, SEQ]);
        service(root, 'gateway', [RPC]);

        const analysis = analyseFleet(root);

        assert.equal(analysis.orm, 'sequelize');
        assert.equal(analysis.sequelize, 2);
        assert.equal(analysis.services, 3);
        assert.equal(analysis.source, 'scan');
        assert.deepEqual(fleetOrmDefaults(analysis), ['sequelize']);
        assert.match(fleetOrmNote(analysis), /Preselected sequelize/);
        // the whole point of preselecting sequelize is not to silence the
        // alternative
        assert.match(fleetOrmNote(analysis), /pg-prisma is worth considering/);
    });

    it('reads a Prisma fleet as pg-prisma', () => {
        const root = fleet();

        service(root, 'lead', [RPC, PRISMA]);

        const analysis = analyseFleet(root);

        assert.equal(analysis.orm, 'pg-prisma');
        assert.deepEqual(fleetOrmDefaults(analysis), ['pg-prisma']);
        assert.match(fleetOrmNote(analysis), /1 service in this fleet/);
    });

    it('recommends pg-prisma for a mixed fleet', () => {
        const root = fleet();

        service(root, 'old', [RPC, SEQ]);
        service(root, 'new', [RPC, PRISMA]);

        const analysis = analyseFleet(root);

        assert.equal(analysis.orm, 'mixed');
        assert.deepEqual(fleetOrmDefaults(analysis), ['pg-prisma']);
        assert.match(fleetOrmNote(analysis), /uses both ORMs/);
    });

    it('preselects nothing when no service uses an ORM', () => {
        const root = fleet();

        service(root, 'gateway', [RPC]);

        const analysis = analyseFleet(root);

        assert.equal(analysis.orm, 'none');
        // Guessing an ORM here would put a database in front of someone who
        // never asked for one.
        assert.deepEqual(fleetOrmDefaults(analysis), []);
        assert.equal(fleetOrmNote(analysis), '');
    });

    it('ignores directories that are not @imqueue services', () => {
        const root = fleet();

        service(root, 'docs', [SEQ]); // no @imqueue/rpc
        mkdirSync(join(root, 'node_modules'), { recursive: true });

        assert.equal(analyseFleet(root).services, 0);
    });

    it('answers from cache on the second call', () => {
        const root = fleet();

        service(root, 'auth', [RPC, SEQ]);

        assert.equal(analyseFleet(root).source, 'scan');
        assert.equal(analyseFleet(root).source, 'cache');
    });

    it('rescans when the fleet gains a directory', () => {
        const root = fleet();

        service(root, 'auth', [RPC, SEQ]);
        assert.equal(analyseFleet(root).orm, 'sequelize');

        service(root, 'lead', [RPC, PRISMA]);

        // A changed directory listing is one readdir to detect, which is what
        // keeps the cache from going stale behind a new service.
        const again = analyseFleet(root);

        assert.equal(again.source, 'scan');
        assert.equal(again.orm, 'mixed');
    });
});

describe('recordOrmChoice()', () => {
    const fleets: string[] = [];

    function fleet(): string {
        const dir = mkdtempSync(join(tmpdir(), 'imq-fleet-'));

        fleets.push(dir);

        return dir;
    }

    after(() => {
        for (const dir of fleets) {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('remembers a choice that contradicts the scan', () => {
        const root = fleet();

        service(root, 'auth', [RPC, SEQ]);
        assert.equal(analyseFleet(root).orm, 'sequelize');

        recordOrmChoice(root, ['pg-prisma']);

        const after = analyseFleet(root);

        assert.equal(after.orm, 'pg-prisma');
        assert.equal(after.source, 'override');
        assert.deepEqual(fleetOrmDefaults(after), ['pg-prisma']);
        assert.match(fleetOrmNote(after), /your earlier choice here/);
    });

    it('keeps the override when the fleet changes but still disagrees', () => {
        const root = fleet();

        service(root, 'auth', [RPC, SEQ]);
        analyseFleet(root);
        recordOrmChoice(root, ['pg-prisma']);

        service(root, 'audit', [RPC, SEQ]);

        // Intent outlives a rescan: the user said pg-prisma for this path.
        assert.equal(analyseFleet(root).orm, 'pg-prisma');
    });

    it('drops the override once the fleet agrees with it', () => {
        const root = fleet();

        service(root, 'auth', [RPC, SEQ]);
        analyseFleet(root);
        recordOrmChoice(root, ['pg-prisma']);

        // fleet migrated: nothing left to override, so a later change is not
        // masked by a stale intent
        rmSync(join(root, 'auth'), { recursive: true, force: true });
        service(root, 'lead', [RPC, PRISMA]);

        const after = analyseFleet(root);

        assert.equal(after.orm, 'pg-prisma');
        assert.equal(after.source, 'scan');
    });

    it('does not treat agreement, or no ORM, as an instruction', () => {
        const root = fleet();

        service(root, 'auth', [RPC, SEQ]);
        analyseFleet(root);

        recordOrmChoice(root, ['sequelize']);
        assert.equal(analyseFleet(root).source, 'cache');

        recordOrmChoice(root, ['pg-cache']);
        assert.equal(analyseFleet(root).source, 'cache');
    });
});
