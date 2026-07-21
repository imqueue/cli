# AGENTS.md — orientation for coding agents

This file is for AI coding agents (and humans who like density) working on
`@imqueue/cli`. It captures how the codebase is built, tested and structured,
plus the invariants and gotchas that are easy to get wrong. Read it before
making changes. For contribution *process/terms* see
[CONTRIBUTING.md](./CONTRIBUTING.md); for end-user docs see the `wiki/`
directory and README.

## What this is

`imq` — a RAD CLI for the @imqueue Redis-RPC microservice framework. It
scaffolds services from templates, wires them to a VCS host / CI / container
registry, generates typed RPC clients, and manages a local fleet of services.

## Toolchain & invariants (do not fight these)

- **ESM only**, `"type": "module"`. No `require()` in `lib/`, `src/`, `index.ts`
  (it is not defined). Use `import`. Import sibling modules with the **`.js`**
  extension (NodeNext resolves it to the `.ts` source).
- **TypeScript 7** (the native compiler), `module`/`moduleResolution: nodenext`,
  `verbatimModuleSyntax: true`, `isolatedModules: true`, `strict`. Use
  `import { type X }` / `import type` for type-only imports.
- **Lint/format:** `oxlint` + `oxfmt`. Run `npm run format` before committing;
  CI checks `npm run format:check`. Do not add editor-specific ignore comments.
- **Node ≥ 22.12**. Tests use the native `node:test` runner with
  `--experimental-test-module-mocks`.
- Build **emits `.js`/`.d.ts`/`.js.map` next to sources**; they are not
  committed. `npm run build` runs `clean-compiled` first, so stale artifacts
  never linger.

## Commands

```bash
npm ci                 # install
npm run build          # clean + tsc (emits alongside sources)
npm test               # build + run every test/**/*.spec.js (node:test)
npm run lint           # oxlint
npm run format         # oxfmt (write)  |  npm run format:check (verify)
npm run test-coverage  # tests + experimental coverage
```

Run a single spec after a build:
`node --experimental-test-module-mocks --import ./test/mocks/index.js --test test/src/ctl.spec.js`

Real end-to-end (containerized, offline-capable):
`bash test/docker/run.sh` — see `test/docker/README.md`.

## Layout

| Path | Role |
|---|---|
| `index.ts` | yargs entry; registers top-level commands |
| `src/*.ts`, `src/**/**.ts` | command modules (each exports `{command,describe,builder,handler}`) |
| `lib/*.ts` | shared library; re-exported from `lib/index.ts` |
| `src/providers/**` | VCS / CI / registry / scm providers + registry/types |
| `src/service/create-*.ts` | service creation: `plan → scaffold → pipeline` |
| `src/catalog/**` + `lib/catalog.json` | addon package catalog engine + data |
| `test/**` | `node:test` specs; `test/mocks/` preload; `test/docker/` harness |

## Command module pattern

A command is a module exporting a yargs command descriptor:

```ts
export const { command, describe, builder, handler } = {
    command: 'ctl <action>',
    describe: '…',
    builder(yargs) { return yargs.option(/* … */); },
    async handler(argv) { try { /* … */ } catch (e) { printError(e); } },
};
```

Parent commands (`service`, `config`, `completions`) just `.command(child)` in
their `builder`. Register a new top-level command in `index.ts`.

## Testability convention (important)

Side-effectful commands factor their I/O behind an injectable **deps
interface** and expose pure-ish orchestration functions; the `handler` builds
`defaultDeps()` (real spawn/git/fs) and calls them. Tests pass fake deps and
assert the recorded calls. Examples: `src/ctl.ts` (`CtlDeps`), `src/up.ts`
(`UpDeps`). Prefer this over mocking `node:child_process` globally. Use temp
dirs (`mkdtempSync`) for filesystem tests; sandbox CLI home via
`IMQ_CLI_HOME` (the mocks preload sets it to `/tmp`).

Spec import depth matters: `test/src/x.spec.ts` uses `../mocks/index.js` and
`../../src/x.js`; `test/src/a/b.spec.ts` uses `../../mocks` and `../../../src`.
Getting this wrong yields `TS2307/TS2882` and a non-zero build that aborts
`npm test`.

## Backward-compatibility invariants (don't break)

- **Config**: `lib/config-schema.ts` keeps the structured v4 keys
  (`vcs`/`ci`/`registry`/`packages`/`templatesRef`) and the legacy keys
  (`gitBaseUrl`, `gitHubAuthToken`, `useGit`, `dockerHub*`, …) **in sync**.
  `deriveStructured()` reads either; writes emit both. A 3.x config must keep
  working (github+travis+dockerhub) and a downgrade must still read what we
  wrote.
- **Templates**: templates repo `master` is frozen; the CLI pins
  `templatesRef = v4` (config-overridable). A template is **v2** iff it has an
  `imq-template.json` manifest, else v1. Don't assume v2.
- **Option precedence everywhere**: flag → `.imqrc.json` (service root) →
  global config → prompt (TTY only) → default. Resolution lives in
  `buildCreatePlan` (`create-plan.ts`); do NOT inject config values as yargs
  `.default()`s (they'd out-rank `.imqrc.json`). `service create` writes
  `.imqrc.json` (secrets excluded); `config set` mirrors structured keys to
  legacy via `applyStructured`.
- **Never prompt when not a TTY** — with two known exceptions: `client generate`
  prompts before overwriting an existing client unless `-o`, and `loadTemplate`
  prompts before re-fetching an already-cached custom git template.

## Environment seams (used for enterprise *and* testing)

`IMQ_CLI_HOME`, `IMQ_NO_UPDATE_CHECK`, `IMQ_TEMPLATES_REPO`,
`IMQ_GITHUB_API_URL`, `IMQ_GITLAB_API_URL`, `IMQ_BITBUCKET_API_URL`,
`IMQ_CIRCLECI_API_URL`, `IMQ_TRAVIS_API_URL`, `IMQ_GIT_REMOTE_BASE`,
`IMQ_CLI_MISSING_COMMANDS` (test seam for `commandExists`).
Any new network endpoint MUST get an `IMQ_*_API_URL` override so it is testable
and enterprise-ready. Default the templates repo to public **HTTPS** (no SSH
key required). Non-`IMQ_` env inputs the code reads: `CIRCLE_TOKEN` (CircleCI
token fallback), `SHELL`/`ZSH_VERSION` (shell detection).

## Local-fleet commands (ported from bash in 4.x)

`imq ctl` / `imq log` / `imq up` replaced `imqctl`/`imqlog`/`imqup`. Shared
source-level discovery lives in `lib/services.ts`
(`discoverServices`/`isServiceDir` — scan `*/src/**.ts` for
`extends IMQ(Service|Client)`). Runtime state under `~/.imq/var`
(`VAR_HOME` in `lib/constants.ts`): `<svc>.log` + `.pids` (`svc:pid` lines).
`ctl` starts services detached (own process group) and stops them with a
negative-pid `SIGTERM` (kills the tree) — no `ps` walking. `ctl` actions:
`start|stop|restart|status`. Logs are truncated per start; calm mode checks
pid liveness (via `isAlive`) so a startup crash is reported at once; a
double-start is refused. `up` deps throw on failure; `runUp` isolates each
service and exits non-zero with a summary. `up`/`update-version` accept
`--bump` as a synonym for the version keyword.

Note two *different* service-detection strategies, by design:
- **source scan** (`lib/services.ts`) for `ctl`/`log`/`up` — no build/import
  needed;
- **module load + prototype-chain check** (`src/service/update-version.ts`
  `containsServiceClass`) for `update-version` — detects a built, runnable
  service regardless of export name.

## Gotchas learned the hard way

- Generated services target ESM + TS + `node:test`; the boilerplate must match
  the current default template (no `require()`/`chai`).
- `service create`'s commit step sets a **repo-local** git identity from the
  author/email, so it works without a global git identity.
- `update-version` must not filter by export name containing "Service" — walk
  the prototype chain.
- Some sandboxes/containers have **no runtime network**; the docker harness is
  network-aware (scaffold-only offline). Two lib tests that used to hit
  nodejs.org are stubbed — keep tests offline/deterministic.
- Author commits **repo-locally** as the project identity; **never modify the
  machine-global git config**.
- The CLI runs yargs `.strict()`: a failed command exits non-zero. Two
  consequences to respect: (1) an option offered as `--no-x` MUST be declared
  as the positive boolean `x` (e.g. `install`), or strict rejects `--no-x` as
  unknown; (2) never read `yargs.argv` inside a `builder` — that early parse
  runs strict validation before positionals are declared and rejects them.
- Failure reporting is centralized: `printError` sets `process.exitCode = 1`,
  so every handler's `catch (e) { printError(e) }` makes the command exit
  non-zero. Don't call `printError` on a recoverable path.

## Current state

Active work is on the **`v4`** branch (target release `4.0.0`), not yet merged
to `master`. During the 4.0 cycle, branch from and PR against `v4` (note:
CONTRIBUTING.md still says `master`, which applies once 4.0 has shipped).
Templates repo `v4` branch holds the v2 default template + `catalog.json`; its
`master` stays frozen until CLI 4.0 ships. Full suite green (`npm test`), lint
+ format clean, docker harness "ALL CHECKS PASSED".
