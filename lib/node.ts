/*!
 * IMQ-CLI library: node
 *
 * Copyright (c) 2018, Mykhailo Stadnyk <mikhus@gmail.com>
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 * OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */
import * as request from 'request';
import * as semver from 'semver';

const RX_VERSION_CLEAN = /^v/;
const RX_ESCAPE = /\./g;

let nodeVersions: NodeVersion[];

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
        case 'latest': {
            return (((versions || /* istanbul ignore next */[])[0] ||
                /* istanbul ignore next */<any>{})
                .version || /* istanbul ignore next */'')
                .replace(RX_VERSION_CLEAN, '');
        }
        case 'node':
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
