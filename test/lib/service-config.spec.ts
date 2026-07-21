/*!
 * @imqueue/cli Unit Tests: service-config
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
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import '../mocks/index.js';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
    loadServiceConfig,
    saveServiceConfig,
    serviceConfigPath,
    SERVICE_CONFIG_FILENAME,
} from '../../lib/index.js';

describe('service-config', () => {
    const dir = mkdtempSync(join(tmpdir(), 'imq-svc-cfg-'));

    after(() => rmSync(dir, { recursive: true, force: true }));

    it('should return an empty object when no file exists', () => {
        assert.deepEqual(loadServiceConfig(dir), {});
    });

    it('should round-trip a saved config', () => {
        const cfg = { vcs: 'github', ci: 'circleci', packages: ['pg-cache'] };

        saveServiceConfig(dir, cfg);
        assert.deepEqual(loadServiceConfig(dir), cfg);
    });

    it('should write to .imqrc.json in the service dir', () => {
        assert.equal(
            serviceConfigPath(dir),
            join(dir, SERVICE_CONFIG_FILENAME),
        );
    });

    it('should return an empty object for a broken file', () => {
        writeFileSync(join(dir, SERVICE_CONFIG_FILENAME), '{ not json');
        assert.deepEqual(loadServiceConfig(dir), {});
    });
});
