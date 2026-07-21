# Extensibility

The v4 architecture is built to be extended along its four axes without
rewrites. This page explains the seams for adapting the tool to your
environment and, for contributors, for adding new providers.

## The provider model

Service creation composes four axes through a typed **provider registry**:

- **VCS host** — creates the remote repo and stores CI secrets. Split from the
  **SCM tool** (git), so the commit/push flow is shared and other SCMs could be
  added later.
- **CI provider** — enables the repo and sets secrets; contributes its workflow
  file as a fragment overlay.
- **Container registry** — supplies the login/push/image-reference snippets.
- **Package catalog** — data-driven addon libraries.

CI and registry combine through generic shell-snippet tokens, so the surface is
**M + N**, not **M × N** — see
[Providers](Providers#how-ci-and-registry-compose).

## Adapting without code: environment seams

Every network endpoint is overridable, which turns the built-in providers into
enterprise/self-hosted ones and makes the whole tool testable:

| Variable | Use |
|---|---|
| `IMQ_GITHUB_API_URL` | GitHub Enterprise Server |
| `IMQ_GITLAB_API_URL` | self-managed GitLab |
| `IMQ_BITBUCKET_API_URL` | Bitbucket Server / Data Center |
| `IMQ_CIRCLECI_API_URL` | CircleCI (or a proxy) |
| `IMQ_TRAVIS_API_URL` | Travis (or a proxy) |
| `IMQ_GIT_REMOTE_BASE` | base for the git remote on commit/push |
| `IMQ_TEMPLATES_REPO` + `templatesRef` | your own template source & ref |

## Adapting without code: data

- **Templates** are a git repo of files with `%TOKEN` placeholders and fragment
  overlays — no CLI release needed to change boilerplate. See
  [Custom Templates](Custom-Templates).
- **The addon catalog** (`catalog.json`) is data: groups, dependencies,
  injection snippets, extra files and advertised env vars. Publish new addons
  by editing it in your template source. See
  [Package Catalog](Package-Catalog#extending-the-catalog).

## For contributors: adding a provider

The providers live under `src/providers/` grouped by axis
(`vcs/`, `ci/`, `registry/`, `scm/`) with shared types in
`src/providers/types.ts` and registration in `src/providers/index.ts`
(`registerBuiltinProviders()`).

To add, say, a new VCS host:

1. Implement the VCS provider interface in `src/providers/vcs/<host>.ts`
   (repo creation, secret storage), reading its API base from a new
   `IMQ_<HOST>_API_URL` env override for testability/enterprise.
2. Register it in `registerBuiltinProviders()`.
3. Add it to the `--vcs` choices and any CI-compatibility filtering.
4. Add unit tests under `test/src/providers/` (mirror the existing
   `vcs.spec.ts` / `ci.spec.ts` style, driving the provider against a mock API
   via the env override).

The same shape applies to CI providers (implement `enable()`/`setSecrets()`,
optional) and registries (supply the `%REGISTRY_LOGIN` / `%REGISTRY_PUSH` /
`%IMAGE_REF` snippets).

## For contributors: the codebase in brief

| Area | Location |
|---|---|
| Command entry (yargs) | `index.ts`, `src/*.ts`, `src/**/**.ts` |
| Shared library | `lib/*.ts` (config, resolve, template, services, github, travis, …) |
| Providers | `src/providers/**` |
| Service creation | `src/service/create-*.ts` (plan → scaffold → pipeline) |
| Addon catalog engine | `src/catalog/**` + `lib/catalog.json` |
| Tests | `test/**` (native `node:test`, module mocks) |

See **AGENTS.md** in the repo root for a deeper orientation aimed at
contributors and AI coding agents (build/test commands, invariants, gotchas).
