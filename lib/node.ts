/*!
 * IMQ-CLI library: node
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
import * as request from 'request';
import * as semver from 'semver';

const RX_VERSION_CLEAN = /^v/;
const RX_ESCAPE = /\./g;

let nodeVersions: NodeVersion[];

/**
 * Sleep given number of milliseconds
 *
 * @param {number} delay - sleep time in milliseconds
 */
export async function sleep(delay: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, delay));
}

export interface NodeVersion {
    version: string;
    date: string;
    files: string[];
    lts: boolean | string;
    v8: string;
    npm?: string;
    uv?: string;
    zlib?: string;
    openssl?: string;
    modules?: string;
}

/**
 * Compares semver, used for sorting
 *
 * @param {string} a
 * @param {string} b
 * @return {number | number}
 */
export function semverCompare(a: string, b: string) {
    return semver.gt(a, b) ? -1 : semver.lt(a, b) ? 1 : 0;
}

/**
 * Loads and returns node all known version definitions from
 * nodejs.org distributions
 *
 * @param {boolean} force
 * @return {Promise<NodeVersion[]>}
 */
export async function getNodeVersions(
    force: boolean = false
): Promise<NodeVersion[]> {
    // istanbul ignore if
    if (!force && nodeVersions) {
        return nodeVersions;
    }

    return new Promise<NodeVersion[]>((resolve, reject) => {
        request('https://nodejs.org/dist/index.json', (err, res) => {
            // istanbul ignore if
            if (err) return reject(err);

            nodeVersions = (JSON.parse(res.body) ||
                /* istanbul ignore next */[])
                .sort((a: NodeVersion, b: NodeVersion) => semverCompare(
                    a.version.replace(RX_VERSION_CLEAN, ''),
                    b.version.replace(RX_VERSION_CLEAN, '')
                ));

            resolve(nodeVersions);
        });
    });
}

/**
 * Returns fully qualified node version string for a given tag
 *
 * @param {string} tag
 * @return {Promise<string>}
 */
export async function nodeVersion(tag: string) {
    const versions = await getNodeVersions();

    switch (tag) {
        case 'node':
        case 'latest': {
            return (((versions || /* istanbul ignore next */[])[0] ||
                /* istanbul ignore next */<any>{})
                .version || /* istanbul ignore next */'')
                .replace(RX_VERSION_CLEAN, '');
        }
        case 'stable':
        case 'lts':
        case 'lts/*': {
            return ((versions.find(version => !!version.lts) ||
                /* istanbul ignore next */<any>{})
                .version || /* istanbul ignore next */'')
                .replace(RX_VERSION_CLEAN, '');
        }
        default: {
            return ((versions.find(version =>
                new RegExp(`^v${tag.replace(RX_ESCAPE, '\\.')}`)
                    .test(version.version)
                ) /* istanbul ignore next */|| <any>{})
                .version || /* istanbul ignore next */'')
                .replace(RX_VERSION_CLEAN, '');
        }
    }
}

/**
 * Converts given node tags to valid travis node tags
 *
 * @param {string | string[]} tags
 * @return {Promise<string[]>}
 */
export async function toTravisTags(tags: string | string[]): Promise<string[]> {
    if (!tags) {
        return [];
    }

    if (typeof tags === 'string') {
        tags = [tags];
    }

    const travisTags: string[] = [];

    for (let tag of tags) {
        switch (tag) {
            case 'stable': case 'lts': travisTags.push('lts/*');
            case 'latest': travisTags.push('node'); break;
            default: travisTags.push(tag); break;
        }
    }

    return travisTags.filter((tag, i) => travisTags.indexOf(tag) === i);
}
