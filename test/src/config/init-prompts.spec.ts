/*!
 * IMQ-CLI Unit Tests: config init prompt wiring
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
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import '../../mocks/index.js';

// mock inquirer before importing the init command so its default-export
// `prompt` is wired correctly (regression: init used a namespace import whose
// `.prompt` was undefined at runtime)
const answers: Record<string, any> = {};

mock.module('inquirer', {
    defaultExport: {
        prompt: async () => answers,
        registerPrompt: () => undefined,
    },
});

const init: any = await import('../../../src/config/init.js');

describe('config init prompt wiring', () => {
    it('should call inquirer.prompt and store the author', async () => {
        answers.author = 'Mocked Author';

        const config: any = {};

        await init.authorName(config);
        assert.equal(config.author, 'Mocked Author');
    });

    it('should call inquirer.prompt and store a valid email', async () => {
        answers.email = 'dev@example.io';

        const config: any = {};

        await init.authorEmail(config);
        assert.equal(config.email, 'dev@example.io');
    });

    it('should resolve the CI provider through a prompt', async () => {
        answers.provider = 'circleci';

        const config: any = { vcs: { provider: 'github' } };

        await init.ciOptions(config);
        assert.equal(config.ci.provider, 'circleci');
    });
});
