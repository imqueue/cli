# @imqueue/cli — User Manual

`@imqueue/cli` (the `imq` command) is a Rapid Application Development tool for
the [@imqueue](https://imqueue.com) framework — a Redis-backed RPC
microservice toolkit for Node.js/TypeScript. It scaffolds services from
templates, wires them to your VCS host, CI provider and container registry,
generates strongly-typed RPC clients, and helps you run and maintain a whole
fleet of services locally.

This manual covers everything from installation to writing your own templates
and adapting the tool to real-world projects.

> **New in 4.x** — the old standalone shell tools `imqctl`, `imqlog` and
> `imqup` are now native subcommands: `imq ctl`, `imq log`, `imq up`.
> Service creation is built on a **four-axis provider model** (VCS host, CI,
> registry, addon packages) that is fully backward compatible with 3.x
> configs. See [Configuration](Configuration) and [Providers](Providers).

## The command surface at a glance

| Command | What it does |
|---|---|
| `imq service create` | Scaffold a new service from a template; optionally create the remote repo, provision CI secrets, commit, push and tag. |
| `imq service update-version` | Bump the version of one or many services on a branch and push, triggering CI. |
| `imq client generate` | Generate a typed RPC client from a running service. |
| `imq config` | `init` / `get` / `set` / `check` the CLI configuration. |
| `imq completions` | Install/remove shell completions (bash & zsh). |
| `imq ctl` | Start / stop / restart a bulk of local services. |
| `imq log` | Tail and combine local service logs. |
| `imq up` | Bulk-update service dependencies (and optionally version/commit/push). |

## Where to start

1. **[Installation](Installation)** — install the CLI and shell completions.
2. **[Configuration](Configuration)** — run `imq config init` to set your
   defaults (VCS host, CI, registry, namespaces, tokens).
3. **[Creating Services](Creating-Services)** — scaffold your first service.
4. **[Managing Local Services](Managing-Local-Services)** — run many services
   at once during development.

## Design principles

- **Non-interactive by default when it can be.** Every option resolves with a
  strict precedence (flag → per-service `.imqrc.json` → global config →
  interactive prompt → default), so CI and scripted runs never hang.
- **Backward compatible.** A config written by 3.x keeps working; the new
  structured keys and the legacy keys are kept in sync.
- **Data-driven where possible.** The addon package catalog and the templates
  live in a separate repo, so they can evolve without a CLI release.
- **Testable and portable.** Every network endpoint has an environment-variable
  override, which also enables GitHub Enterprise, self-managed GitLab and
  Bitbucket Cloud-compatible endpoints.

## Conventions in this manual

- `~/.imq/` is the CLI home; override the base with `IMQ_CLI_HOME`.
- Shell snippets assume a POSIX shell. Windows users should use WSL or Git Bash.
- Angle brackets `<like-this>` mark required values; square brackets
  `[like-this]` mark optional ones.
