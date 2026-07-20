/*!
 * IMQ-CLI providers: ci/common
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
import { containerRegistries } from '../registry.js';
import type { ContainerRegistryProvider, CreateContext } from '../types.js';

/**
 * Resolves the registry provider selected for a run, or null when none.
 *
 * @param {CreateContext} ctx
 * @return {ContainerRegistryProvider | null}
 */
export function registryOf(
    ctx: CreateContext,
): ContainerRegistryProvider | null {
    const id = ctx.config.registry.provider;

    return id && containerRegistries.has(id)
        ? containerRegistries.get(id)
        : null;
}

/**
 * The generic registry shell tokens a CI config references, so any CI works
 * with any registry (M+N composition). Empty strings when not dockerizing.
 *
 * @param {CreateContext} ctx
 * @return {{ IMAGE_REF: string; REGISTRY_LOGIN: string; REGISTRY_PUSH: string }}
 */
export function registryShellTokens(ctx: CreateContext): {
    IMAGE_REF: string;
    REGISTRY_LOGIN: string;
    REGISTRY_PUSH: string;
} {
    const registry = registryOf(ctx);

    if (!ctx.dockerize || !registry) {
        return { IMAGE_REF: '', REGISTRY_LOGIN: '', REGISTRY_PUSH: '' };
    }

    return {
        IMAGE_REF: registry.imageRef(ctx),
        REGISTRY_LOGIN: registry.loginCmd(),
        REGISTRY_PUSH: registry.pushCmd(),
    };
}
