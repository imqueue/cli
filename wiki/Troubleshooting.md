# Troubleshooting

## `imq config init` / prompts hang or fail in CI

Prompts only appear on a TTY. In CI, provide values via flags or config and add
`-y` to `service create`. If a value is missing and there is no TTY, the
default is used rather than blocking.

## Template fetch fails / asks for SSH credentials

The default template is fetched over public **HTTPS**, so no SSH key is
required. If you overrode the source with an SSH URL via `IMQ_TEMPLATES_REPO`,
either set up your SSH key or unset the variable to use the HTTPS default. To
pin a different ref: `imq config set templatesRef <ref>`.

## `git commit` fails: "unable to auto-detect email address"

The create pipeline sets a **local** git identity from the service author/email
before committing, so this should not occur during `service create`. If you hit
it in your own scripts, set a repo-local identity:

```bash
git -C <service> config user.name  "Your Name"
git -C <service> config user.email "you@example.com"
```

## Repo creation returns 401/403

Check the token and its scopes for the selected VCS host
([Providers](Providers#vcs-hosts---vcs)): GitHub needs `repo` (and `admin:org`
for org repos / Actions secrets), GitLab needs `api`, Bitbucket needs a
repository-scoped access token (sent as a Bearer token). Pass it with `-T` or
set `vcs.auth.token`.

## Nothing happens on an enterprise/self-hosted host

Set the matching API base URL and (if the git host differs) the remote base:

```bash
export IMQ_GITHUB_API_URL=https://github.mycorp.com/api/v3
export IMQ_GIT_REMOTE_BASE=git@github.mycorp.com:
```

See [Configuration](Configuration#environment-variable-reference).

## `imq ctl` / `imq log` / `imq up` find no services

Discovery scans immediate sub-directories of the path (`-p`, default cwd) for a
class extending `IMQService`/`IMQClient` under `src/`. Ensure you point at the
**parent** directory that contains the service repos, or pass `-s name1,name2`
to target them explicitly.

## A service won't start with `imq ctl`

- It must have an `npm run dev` script. Check
  `~/.imq/var/<service>.log` for the actual error.
- In calm mode (`-c`) the CLI waits for the log line
  `reader channel connected`; if your service never prints it, calm mode will
  warn and move on after a bounded wait — the service may still be running,
  just not detected as "ready".

## `imq ctl stop` didn't kill child processes

Services are started in their own process group and stopped with a group
`SIGTERM`. If a service double-forks outside its group, terminate it manually
using the pid in `~/.imq/var/.pids`.

## `imq up` reports "Nothing to perform"

`--skip-update` without `--commit` is a no-op. Either drop `--skip-update`
(to update deps) or add `--commit` (to re-commit/bump without updating).

## `imq client generate` fails

The target service must be **running** and Redis reachable so its interface can
be introspected. Start it first (e.g. `imq ctl start -s <name> -c`), then
generate.

## Config or secrets leaked into a shared machine

`~/.imq/config.json` is written `0600`. Prefer passing tokens per-invocation
(`-T`) or via environment injection in shared/CI environments rather than
persisting them in the config.

## Resetting everything

```bash
rm -rf ~/.imq        # config, cached templates, custom templates, logs, pids
```

Or sandbox a run entirely: `IMQ_CLI_HOME=/tmp/imq-sandbox imq …`.
