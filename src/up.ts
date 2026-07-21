/*!
 * @imqueue/cli command: up
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
import { discoverServices, parseServices, printError } from '../lib/index.js';

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
 * Each service is processed independently: a step that fails (a thrown dep,
 * e.g. a non-zero `git pull`) aborts only that service, is recorded, and the
 * run continues with the next. If any service failed, a summarizing error is
 * thrown so the caller can report it and exit non-zero.
 *
 * @param {UpOptions} opts
 * @param {UpDeps} deps
 * @return {void}
 * @throws {Error} when neither an update nor a commit is requested, when the
 *                 ncu bootstrap fails, or when one or more services failed
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
        deps.log('No @imqueue services found to update.');

        return;
    }

    // bootstrap ncu once up front; a failure here is fatal (nothing can run)
    if (!opts.skipUpdate && !deps.ncuAvailable()) {
        deps.log('Installing npm-check-updates...');
        deps.installNcu();
    }

    const type = normalizeVersionType(opts.npmVersion);
    const failed: string[] = [];
    let ok = 0;

    for (const svc of services) {
        const dir = join(opts.path, svc);

        if (!existsSync(dir)) {
            deps.log(styleText('red', `No such service directory: ${dir}`));
            failed.push(svc);

            continue;
        }

        deps.log(styleText('blue', `\nService: ${svc}`));

        try {
            // When we are about to update AND commit, capture whether the tree
            // was already dirty BEFORE we touch it. If it was, the user has
            // uncommitted work of their own; committing would sweep it into
            // (and push) our "dependencies update" commit - so we refuse and
            // warn instead. With --skip-update the user explicitly asked to
            // commit whatever is there, so this guard does not apply.
            const guardPreexistingChanges = opts.commit && !opts.skipUpdate;
            const preexistingChanges =
                guardPreexistingChanges && deps.gitDirty(dir);

            if (!opts.skipUpdate) {
                // ordered so a failure aborts BEFORE anything destructive
                // (ncu rewrite / node_modules + lockfile removal)
                deps.gitPull(dir);
                deps.ncuUpgrade(dir);
                deps.removeArtifacts(dir);
                deps.npmInstall(dir);
            }

            if (opts.commit) {
                if (preexistingChanges) {
                    deps.log(
                        styleText(
                            'yellow',
                            `  ${svc} had uncommitted changes before the ` +
                                'update; skipping commit to avoid committing ' +
                                'unrelated work (commit or stash them, then ' +
                                'rerun).',
                        ),
                    );
                } else if (deps.gitDirty(dir)) {
                    deps.gitCommit(dir, COMMIT_MESSAGE);
                    deps.npmVersion(dir, type);
                    deps.gitPushTags(dir);
                } else {
                    deps.log('Nothing to commit, working tree clean.');
                }
            }

            ok++;
        } catch (err) {
            failed.push(svc);
            deps.log(
                styleText('red', `  ${svc} failed: ${(err as Error).message}`),
            );
        }
    }

    if (failed.length) {
        throw new Error(
            `Updated ${ok}/${services.length} services; ` +
                `failed: ${failed.join(', ')}.`,
        );
    }

    deps.log(styleText('green', `\nDone! Updated ${ok} service(s).`));
}

/**
 * Builds the production dependency set (real spawning and filesystem).
 *
 * @return {UpDeps}
 */
export function defaultDeps(): UpDeps {
    // runs a command, throwing a descriptive Error on spawn error or non-zero
    // exit so the per-service loop in runUp can record the failure and skip
    // the remaining (potentially destructive) steps for that service
    const run = (cmd: string, args: string[], cwd?: string): void => {
        const res = spawnSync(cmd, args, { cwd, stdio: 'inherit' });

        if (res.error) {
            throw new Error(`${cmd}: ${res.error.message}`);
        }

        if (res.status !== 0) {
            throw new Error(
                `${cmd} ${args.join(' ')} exited with code ${res.status}`,
            );
        }
    };

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
            // -uno: ignore untracked files so a stray file (editor swap, .env)
            // never triggers a spurious version bump; only tracked changes
            // (the ncu/lockfile update) count as "dirty"
            const res = spawnSync('git', ['status', '--porcelain', '-uno'], {
                cwd: dir,
                encoding: 'utf8',
            });

            // a git failure (not a repo, git missing) must NOT read as a clean
            // tree - that would silently skip the commit and report success;
            // throw so the per-service loop records it as a failure
            if (res.error) {
                throw new Error(`git status: ${res.error.message}`);
            }

            if (res.status !== 0) {
                throw new Error(
                    `git status exited with code ${res.status}` +
                        (res.stderr ? `: ${res.stderr.toString().trim()}` : ''),
                );
            }

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
        'Updates dependencies of @imqueue services under a given path and, ' +
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
                alias: ['npm-version', 'bump'],
                default: 'prerelease',
                choices: VERSION_TYPES,
                describe: 'Version bump to apply on commit.',
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
            const services = parseServices(argv.services);

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
        }
    },
};
