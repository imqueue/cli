# Clients & Versioning

## Generating typed RPC clients

`imq client generate` produces a strongly-typed RPC client from a **running**
service — the service must be up (and Redis reachable) so its interface can be
introspected; otherwise generation fails.

**The generated client is a file you commit.** It is written into your repository
like any other source, which is what gives the service's interface a reviewable
artifact: change a method signature, regenerate, and the change appears as a
**diff in the pull request that causes it**. The reviewer reads the contract
change instead of inferring it. There is no separate schema file to check in,
because the committed client *is* the checked-in contract — generated from the
implementation rather than hand-maintained beside it.

```bash
imq client generate <name> [path]
```

| Flag | Meaning |
|---|---|
| (positional) `name` | the service's **queue** name (required) — see below |
| (positional) `path` | directory to place the client file (default: cwd) |
| `-o, --overwrite` | overwrite an existing client without prompting |
| `-w, --timeout` | seconds to wait for the service to respond before giving up (default `30`; `0` waits forever) |

The name is the queue the service listens on, which `IMQService` defaults to its
own class name (`this.name = name || this.constructor.name`), and the CLI passes
it straight to `IMQClient.create()`. So it is `BillingService`, not `billing` —
and in particular it is **not** the project directory name that `imq ctl -s`
takes. Get it wrong and generation waits for a queue nobody is listening on, then
times out.

```bash
# from within a project, with the BillingService class running locally
imq client generate BillingService ./src/clients -o
```

Typical flow during development. The two names in it are different things: `-s`
selects the local service by directory, while `generate` takes the queue name:

```bash
imq ctl start -s billing -c     # bring the service up and wait for readiness
imq client generate BillingService ./src/clients
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
| `-n, --npm-version`, `--bump` | bump type: `major\|minor\|patch\|prerelease` (default `prerelease`). Unlike `imq up`, `update-version` does not constrain the keyword — any value is passed through to `npm version`. |

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

## FAQ

### Is the generated client committed to the repository?

Yes. `imq client generate` writes the client into your source tree and it is
committed like any other file. That is deliberate: it is what makes an interface
change reviewable. Regenerating after a signature change produces a diff in the
pull request that causes it, so the contract change is visible at review time
rather than discovered at runtime by a caller.

### Should I generate clients in CI instead of committing them?

No, and it is usually impractical. Generation introspects a **running** service,
so a CI job would have to start the service and a Redis for every build just to
produce a file that is deterministic anyway. Committing it is cheaper, and it
keeps the property that matters — the diff. Regenerate locally with
`imq client generate <QueueName> <path> -o` as part of the change that alters the
interface, and commit the result alongside it.
