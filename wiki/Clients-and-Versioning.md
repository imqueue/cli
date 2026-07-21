# Clients & Versioning

## Generating typed RPC clients

`imq client generate` produces a strongly-typed RPC client from a **running**
service — the service must be up (and Redis reachable) so its interface can be
introspected; otherwise generation fails.

```bash
imq client generate <name> [path]
```

| Flag | Meaning |
|---|---|
| (positional) `name` | service name to generate a client for (required) |
| (positional) `path` | directory to place the client file (default: cwd) |
| `-o, --overwrite` | overwrite an existing client without prompting |

```bash
# from within a project, service "billing" running locally
imq client generate billing ./src/clients -o
```

Typical flow during development:

```bash
imq ctl start -s billing -c     # bring the service up and wait for readiness
imq client generate billing ./src/clients
imq ctl stop -s billing
```

## Bumping versions across many services

`imq service update-version` releases a new version across one or many
services under a directory and pushes, triggering CI builds.

```bash
imq service update-version <path> [branch]
```

| Flag | Meaning |
|---|---|
| (positional) `path` | directory containing the services (or a single service) |
| (positional) `branch` / `-b` | branch to checkout/use (default `master`) |
| `-n, --npm-version` | bump type: `major\|minor\|patch\|prerelease` (default `prerelease`) |

For each detected service it runs, stopping that service on the first failing
step:

```
git checkout <branch>  →  git pull  →  npm version <n>  →  git push --follow-tags
```

Detection here is by **loading the built module** and checking whether any
export derives from `IMQService` (by walking the prototype chain — the service
class need not be named `*Service`). Compare with `imq up`/`imq ctl`, which
detect by scanning source. Use `update-version` for a release action against
built, committed services; use `imq up` for dependency maintenance.

```bash
# patch-release every service under ./services on the main branch
imq service update-version ./services main -n patch
```

## `update-version` vs `up`

| | `imq service update-version` | `imq up` |
|---|---|---|
| Purpose | release/version bump | dependency maintenance |
| Detects services by | module load (prototype chain) | source scan (`extends IMQService/IMQClient`) |
| Touches deps? | no | yes (`ncu -u` + reinstall) |
| Git flow | checkout → pull → version → push | (optionally) commit → version → push |
| Branch control | `-b/[branch]` | uses current branch |
