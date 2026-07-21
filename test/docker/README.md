# Containerized test harness

A clean, reproducible environment that runs the unit suite plus real
end-to-end checks of the CLI (service creation, config, completions). The
image has **no SSH key**, so it also proves templates are fetched over public
HTTPS.

## Full image (needs network)

Builds the CLI from scratch and runs the whole matrix — create → `npm install`
→ `tsc` build → `npm test` of the generated services, across CI providers and
addon packages:

```bash
docker build -f test/docker/Dockerfile -t imqueue-cli-test .
docker run --rm imqueue-cli-test
```

## Offline / host-mounted run

Reuses the host's `node_modules`/build and a local `../templates` checkout, so
it works without container network (scaffold-only for generated services):

```bash
bash test/docker/run.sh
```

## What it checks

1. Unit test suite (deterministic — no live network calls).
2. `imq --version`, `service create --help`, `service create --dry-run`.
3. Real `service create` for each CI provider (and, online, addon packages),
   then install + build + test of the generated service.
4. `config check`/`set`/`get` (incl. dot-paths) and `completions on`.
5. `imq ctl`/`log`/`up` real process orchestration (offline): `ctl start -c`
   with fake services, pid-file write, readiness-marker detection,
   `log --no-follow`, `ctl stop`, the `up` no-op guard, and a real
   `up --commit` bump/commit/push against a local bare git remote.

Exit code is non-zero if any check fails.
