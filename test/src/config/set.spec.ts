/*!
 * IMQ-CLI Unit Tests: config set
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
import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, unlinkSync } from 'node:fs';
import '../../mocks/index.js';
import * as client from '../../../src/config/set.js';
import { CONFIG_PATH, loadConfig } from '../../../lib/index.js';

function set(option: string, value: unknown): void {
    (client.handler as (a: unknown) => void)({ option, value });
}

describe('config set', () => {
    beforeEach(() => {
        if (existsSync(CONFIG_PATH)) {
            unlinkSync(CONFIG_PATH);
        }
    });

    it('should be a valid command definition', () => {
        assert.equal(typeof client.command, 'string');
        assert.ok(client.command.includes('set'));
        assert.equal(typeof client.describe, 'string');
        assert.notEqual(client.describe.length, 0);
        assert.equal(typeof client.handler, 'function');
    });

    it('should mirror a structured write to the legacy keys', () => {
        set('vcs.provider', 'gitlab');

        // a non-github host disables the legacy git flow (downgrade safety)
        assert.equal(loadConfig().useGit, false);
    });

    it('should NOT resurrect travis across successive sets', () => {
        set('vcs.provider', 'gitlab');
        set('vcs.namespace', 'mygroup');

        // the mirrored legacy keys must not be mistaken for a v3 install
        assert.equal(loadConfig().ci?.provider, undefined);
    });

    it('should sync a legacy key into the structured view', () => {
        set('vcs.provider', 'github');
        set('vcs.auth.token', 'ghp_old');
        set('gitHubAuthToken', 'ghp_new');

        // the structured token must reflect the freshly-set legacy value
        assert.equal(loadConfig().vcs.auth.token, 'ghp_new');
    });

    it('should accept a comma-separated packages list', () => {
        set('packages', 'opentelemetry,pg-cache');

        assert.deepEqual(loadConfig().packages, ['opentelemetry', 'pg-cache']);
    });
});
