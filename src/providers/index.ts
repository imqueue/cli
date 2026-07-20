/*!
 * IMQ-CLI providers: builtins registration
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
import {
    ciProviders,
    containerRegistries,
    scmTools,
    vcsHosts,
} from './registry.js';
import { github } from './vcs/github.js';
import { git } from './scm/git.js';
import { travis } from './ci/travis.js';
import { dockerhub } from './registry/dockerhub.js';

let registered = false;

/**
 * Registers the built-in providers into their axis registries. Idempotent, so
 * it is safe to call from multiple entry points (command handlers, tests).
 */
export function registerBuiltinProviders(): void {
    if (registered) {
        return;
    }

    registered = true;

    vcsHosts.register(github);
    scmTools.register(git);
    ciProviders.register(travis);
    containerRegistries.register(dockerhub);
}

export * from './registry.js';
export * from './types.js';
