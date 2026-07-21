# Managing Local Services

During development it is common to run several @imqueue services on your host
at once. The `imq ctl`, `imq log` and `imq up` commands manage a whole fleet of
service repositories sitting side-by-side in one directory.

> These replace the 3.x shell tools `imqctl`, `imqlog`, `imqup`. Options are
> unchanged.

## Service discovery

`imq ctl` and `imq up` share the same discovery. When `-s/--services` is
**not** given, they scan the target path (`-p`, default: current directory) for
immediate sub-directories whose `src/` tree contains a class extending
`IMQService` or `IMQClient`. This is a **source-level** scan — it needs neither
a build nor a running service, so it works on freshly-cloned, uninstalled
repos. Pass `-s alpha,beta` to target specific services and skip the scan.
(`imq log` does not scan a path; it works off the `*.log` files already
collected under `~/.imq/var`.)

Runtime state lives under `~/.imq/var/`:

- `~/.imq/var/<service>.log` — captured stdout/stderr per service (truncated
  each time the service is started)
- `~/.imq/var/.pids` — `service:pid` records of running masters, written
  incrementally as each service starts

## `imq ctl` — start / stop / restart / status

```bash
imq ctl <start|stop|restart|status> [-p path] [-s services] [-u] [-c] [-v]
```

| Flag | Meaning |
|---|---|
| `-p, --path` | directory containing the service repos (default: cwd) |
| `-s, --services` | comma-separated service names (skips discovery) |
| `-u, --update` | run `git pull` in each service before starting (a failed pull skips that service) |
| `-c, --calm` | wait for each service to become ready before starting the next |
| `-v, --verbose` | print total execution time |

**Start** launches each service via its `npm run dev` script in its own
process group, redirecting output to `~/.imq/var/<service>.log`, and records
the master pid. A service that is **already running** (its recorded pid is
live) is skipped with a warning — use `restart` to restart it.

**Calm mode** (`-c`) polls the log for the readiness marker
`reader channel connected` before moving on, so services with startup
dependencies come up in order. Because the log is truncated on start, the scan
only sees the current run. If a service **exits during startup** it is reported
at once (rather than waiting out the bounded timeout).

**Stop** terminates each targeted service's entire process group with
`SIGTERM` (so child processes die too) and runs its `npm run stop` script if it
has one. Pids of services you did not target are preserved in the pid file.

**Restart** = stop then start. **Status** lists each tracked service and
whether its recorded pid is live or stale.

```bash
# start everything under ~/work/services, waiting for each to be ready
imq ctl start -p ~/work/services -c

# see what is running
imq ctl status -p ~/work/services

# restart just two services, pulling latest first
imq ctl restart -s billing,orders -u

# stop everything
imq ctl stop -p ~/work/services
```

## `imq log` — combined logs

```bash
imq log [services..] [-c] [-f] [-P]
```

| Flag | Meaning |
|---|---|
| (positional) | service names to show (default: all available logs) |
| `-c, --clean` | delete collected logs and exit (scoped to the named services, or all logs when none are named) |
| `-f, --follow` | follow appended data (default **on**; `--no-follow` dumps and exits) |
| `--no-prefix` | do not prefix lines with the service name (`-P` for short) |

When more than one log is shown, each line is prefixed with a coloured
`[service]` tag so interleaved output stays readable. `--no-follow` is handy in
scripts to snapshot current logs and return immediately.

```bash
imq log                 # tail & combine every service log
imq log billing orders  # only these two
imq log --no-follow      # dump current logs and exit
imq log --clean          # wipe all collected logs
imq log billing --clean  # wipe only billing's log
```

## `imq up` — bulk dependency update

```bash
imq up [-p path] [-s services] [-v type] [-c] [-u]
```

| Flag | Meaning |
|---|---|
| `-p, --path` | directory containing the service repos (default: cwd) |
| `-s, --services` | comma-separated service names (skips discovery) |
| `-v, --npm-version`, `--bump` | version bump on commit: `major\|minor\|patch\|prerelease` (default `prerelease`) |
| `-c, --commit` | commit, version-bump and push the update |
| `-u, --skip-update` | skip the dependency update, perform other tasks only |

For each service the update runs `git pull` → `ncu -u`
([npm-check-updates](https://www.npmjs.com/package/npm-check-updates),
installed globally on first use if missing) → remove `node_modules` +
`package-lock.json` → `npm install`. With `-c` it then commits
`chore: dependencies update`, runs `npm version <type>` and
`git push --follow-tags` — but **only when the working tree actually changed**
(a stray *untracked* file does not count as a change). A step that fails aborts
that service **before** any destructive step, is recorded, and the run
continues with the next service; the command exits non-zero and prints a
summary if any service failed. `-v` only accepts the four bump keywords
(anything else is rejected).

`imq up --skip-update` without `--commit` is a no-op and is rejected with a
helpful message. Make sure services are not in a dirty git state before an
update+commit run.

```bash
# update deps everywhere, no git changes
imq up -p ~/work/services

# update, then patch-bump, commit and push each changed service
imq up -p ~/work/services -c -v patch

# only re-commit/bump (no dep update) — e.g. after a manual edit
imq up -s billing --skip-update --commit -v minor
```

See [Real-World Scenarios](Real-World-Scenarios) for end-to-end fleet
workflows.
