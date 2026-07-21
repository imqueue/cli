/*!
 * IMQ-CLI command: up
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
import { rmSync, existsSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { styleText } from 'node:util';
import { type Argv, type Arguments } from 'yargs';
import { discoverServices, printError } from '../lib/index.js';

/** Accepted npm version bump keywords. */
const VERSION_TYPES = ['major', 'minor', 'patch', 'prerelease'] as const;
export type VersionType = (typeof VERSION_TYPES)[number];
/** Commit message used when committing a dependency bump. */
const COMMIT_MESSAGE = 'chore: dependencies update';

/**
 * Side-effectful primitives used by the `up` orchestration, extracted behind
 * an interface so the flow can be unit-tested with fakes.
 */
export interface UpDeps {
    /** True if `npm-check-updates` (ncu) is available on PATH. */
    ncuAvailable(): boolean;
    /** Installs `npm-check-updates` globally. */
    installNcu(): void;
    /** Runs `git pull` in the service directory. */
    gitPull(dir: string): void;
    /** Runs `ncu -u` in the service directory. */
    ncuUpgrade(dir: string): void;
    /** Removes `node_modules` and `package-lock.json`. */
    removeArtifacts(dir: string): void;
    /** Runs `npm install` in the service directory. */
    npmInstall(dir: string): void;
    /** True if the working tree has uncommitted changes. */
    gitDirty(dir: string): boolean;
    /** Commits all changes with the given message. */
    gitCommit(dir: string, message: string): void;
    /** Runs `npm version <type>` in the service directory. */
    npmVersion(dir: string, type: VersionType): void;
    /** Runs `git push --follow-tags`. */
    gitPushTags(dir: string): void;
    /** Writes a status line for the user. */
    log(msg: string): void;
}

/** Options controlling an `up` invocation. */
export interface UpOptions {
    path: string;
    services?: string[];
    npmVersion: string;
    commit: boolean;
    skipUpdate: boolean;
}

/**
 * Normalises a version-bump keyword, defaulting anything unrecognised to
 * `prerelease` (matching the legacy bash behaviour).
 *
 * @param {string} type - raw keyword from the CLI
 * @return {VersionType}
 */
export function normalizeVersionType(type: string): VersionType {
    return (VERSION_TYPES as readonly string[]).includes(type)
        ? (type as VersionType)
        : 'prerelease';
}

/**
 * Updates dependencies (and optionally version-bumps, commits and pushes) for
 * every selected service under the given path.
 *
 * @param {UpOptions} opts
 * @param {UpDeps} deps
 * @return {void}
 * @throws {Error} when neither an update nor a commit is requested
 */
export function runUp(opts: UpOptions, deps: UpDeps): void {
    if (opts.skipUpdate && !opts.commit) {
        throw new Error(
            'Nothing to perform: enable an update and/or a commit ' +
                '(remove --skip-update or add --commit).',
        );
    }

    const services = discoverServices(opts.path, opts.services);

    if (!services.length) {
        deps.log('No IMQ services found to update.');

        return;
    }

    if (!opts.skipUpdate && !deps.ncuAvailable()) {
        deps.log('Installing npm-check-updates...');
        deps.installNcu();
    }

    const type = normalizeVersionType(opts.npmVersion);

    for (const svc of services) {
        const dir = join(opts.path, svc);

        if (!existsSync(dir)) {
            deps.log(styleText('red', `No such service directory: ${dir}`));

            continue;
        }

        deps.log(styleText('blue', `\nService: ${svc}`));

        if (!opts.skipUpdate) {
            deps.gitPull(dir);
            deps.ncuUpgrade(dir);
            deps.removeArtifacts(dir);
            deps.npmInstall(dir);
        }

        if (opts.commit) {
            if (deps.gitDirty(dir)) {
                deps.gitCommit(dir, COMMIT_MESSAGE);
                deps.npmVersion(dir, type);
                deps.gitPushTags(dir);
            } else {
                deps.log('Nothing to commit, working tree clean.');
            }
        }
    }

    deps.log(styleText('green', '\nDone!'));
}

/**
 * Builds the production dependency set (real spawning and filesystem).
 *
 * @return {UpDeps}
 */
export function defaultDeps(): UpDeps {
    const run = (
        cmd: string,
        args: string[],
        cwd?: string,
    ): ReturnType<typeof spawnSync> =>
        spawnSync(cmd, args, { cwd, stdio: 'inherit' });

    return {
        ncuAvailable(): boolean {
            const res = spawnSync('ncu', ['--version'], { stdio: 'ignore' });

            return !res.error && res.status === 0;
        },
        installNcu(): void {
            run('npm', ['i', '-g', 'npm-check-updates']);
        },
        gitPull(dir: string): void {
            run('git', ['pull'], dir);
        },
        ncuUpgrade(dir: string): void {
            run('ncu', ['-u'], dir);
        },
        removeArtifacts(dir: string): void {
            rmSync(join(dir, 'node_modules'), { recursive: true, force: true });
            rmSync(join(dir, 'package-lock.json'), { force: true });
        },
        npmInstall(dir: string): void {
            run('npm', ['install'], dir);
        },
        gitDirty(dir: string): boolean {
            const res = spawnSync('git', ['status', '--porcelain'], {
                cwd: dir,
                encoding: 'utf8',
            });

            return !!res.stdout && res.stdout.trim().length > 0;
        },
        gitCommit(dir: string, message: string): void {
            run('git', ['commit', '-am', message], dir);
        },
        npmVersion(dir: string, type: VersionType): void {
            run('npm', ['version', type], dir);
        },
        gitPushTags(dir: string): void {
            run('git', ['push', '--follow-tags'], dir);
        },
        log(msg: string): void {
            process.stdout.write(msg + '\n');
        },
    };
}

export const { command, describe, builder, handler } = {
    command: 'up',
    describe:
        'Updates dependencies of IMQ services under a given path and, ' +
        'optionally, version-bumps, commits and pushes them.',

    builder(yargs: Argv) {
        return yargs
            .option('p', {
                alias: 'path',
                default: '.',
                describe:
                    'Path to a directory with service repositories ' +
                    '(default: current directory).',
                type: 'string',
            })
            .option('s', {
                alias: 'services',
                describe:
                    'Comma-separated list of service (repository) names. ' +
                    'If omitted, the path is scanned for services.',
                type: 'string',
            })
            .option('v', {
                alias: 'npm-version',
                default: 'prerelease',
                describe:
                    'Version bump to apply on commit ' +
                    '(major|minor|patch|prerelease).',
                type: 'string',
            })
            .option('c', {
                alias: 'commit',
                default: false,
                describe: 'Commit, version-bump and push the changes.',
                type: 'boolean',
            })
            .option('u', {
                alias: 'skip-update',
                default: false,
                describe:
                    'Skip the dependency update, performing other ' +
                    '(e.g. commit) tasks only.',
                type: 'boolean',
            });
    },

    handler(argv: Arguments) {
        try {
            const services =
                typeof argv.services === 'string'
                    ? (argv.services as string).split(',')
                    : undefined;

            runUp(
                {
                    path: argv.path as string,
                    services,
                    npmVersion: argv.npmVersion as string,
                    commit: !!argv.commit,
                    skipUpdate: !!argv.skipUpdate,
                },
                defaultDeps(),
            );
        } catch (err) {
            printError(err as Error);
            process.exitCode = 1;
        }
    },
};
