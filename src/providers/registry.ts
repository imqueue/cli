/*!
 * IMQ-CLI providers: registry
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
import type {
    CiProvider,
    ContainerRegistryProvider,
    Provider,
    ScmProvider,
    VcsHostProvider,
} from './types.js';

/**
 * A small typed registry of providers for a single axis (vcs/ci/registry/scm).
 * Keeps registration and lookup uniform so new providers plug in without
 * touching call sites.
 */
export class ProviderRegistry<T extends Provider> {
    private readonly items = new Map<string, T>();

    public constructor(private readonly axis: string) {}

    /**
     * Registers a provider (last registration for an id wins).
     *
     * @param {T} provider
     * @return {this}
     */
    public register(provider: T): this {
        this.items.set(provider.id, provider);

        return this;
    }

    /**
     * Returns a provider by id or throws when it is unknown, listing the
     * available ids to help the caller.
     *
     * @param {string} id
     * @return {T}
     */
    public get(id: string): T {
        const provider = this.items.get(id);

        if (!provider) {
            throw new Error(
                `Unknown ${this.axis} provider "${id}". ` +
                    `Available: ${this.ids().join(', ') || '(none)'}.`,
            );
        }

        return provider;
    }

    /**
     * Returns a provider by id, or undefined when it is unknown.
     *
     * @param {string} id
     * @return {T | undefined}
     */
    public tryGet(id: string): T | undefined {
        return this.items.get(id);
    }

    /**
     * Checks whether a provider id is registered.
     *
     * @param {string} id
     * @return {boolean}
     */
    public has(id: string): boolean {
        return this.items.has(id);
    }

    /**
     * Lists all registered providers in registration order.
     *
     * @return {T[]}
     */
    public list(): T[] {
        return [...this.items.values()];
    }

    /**
     * Lists all registered provider ids in registration order.
     *
     * @return {string[]}
     */
    public ids(): string[] {
        return [...this.items.keys()];
    }
}

/** the four axis registries; populated by provider modules as they load */
export const vcsHosts = new ProviderRegistry<VcsHostProvider>('vcs');
export const scmTools = new ProviderRegistry<ScmProvider>('scm');
export const ciProviders = new ProviderRegistry<CiProvider>('ci');
export const containerRegistries =
    new ProviderRegistry<ContainerRegistryProvider>('registry');
