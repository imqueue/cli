# Creating Services

`imq service create` scaffolds a new @imqueue service from a template and,
optionally, creates the remote repository, provisions CI secrets, commits,
pushes and tags it.

```bash
imq service create <name> [path]
```

If omitted, `name` defaults to the current directory's name and `path` to `.`
(the current directory).

## The four axes

Service creation is organized around four independent, pluggable axes, so you
can mix the tools you actually use. Each resolves via the standard precedence
(flag → `.imqrc.json` → global config → prompt → default).

| Axis | Flag | Choices (default **bold**) |
|---|---|---|
| VCS host | `--vcs` | **github**, gitlab, bitbucket |
| CI provider | `--ci` | **github-actions**, circleci, travis |
| Container registry | `--registry` | **dockerhub**, google, aws-ecr, azure-acr |
| Addon packages | `--packages` | (none) — see [Package Catalog](Package-Catalog) |

CI choices are filtered to those compatible with the selected VCS host. See
[Providers](Providers) for the details and tokens each one needs.

## Options

```
imq service create [name] [path]

  -a, --author            Author full name (person or organization)
  -e, --email             Author contact email
  -g, --use-git           Turn on automatic repo creation            [boolean]
      --vcs               VCS host: github | gitlab | bitbucket
  -u, --github-namespace  VCS namespace (user, organization, workspace)
      --ci                CI provider: github-actions | circleci | travis
      --registry          Registry: dockerhub | google | aws-ecr | azure-acr
      --region            Registry region (google, aws-ecr)
      --project           GCP project id (google)
      --account-id        AWS account id (aws-ecr)
      --packages          Comma-separated addon packages (--no-packages = none)
      --no-install        Do not run npm install after scaffolding   [boolean]
  -V, --service-version   Initial version                [default: "1.0.0-0"]
  -H, --homepage          Homepage URL
  -B, --bugs-url          Bug tracker URL
  -l, --license           SPDX id or path to a custom license file
  -t, --template          Template name, git url, or local directory
  -d, --description       Service description
  -n, --node-versions     Node version tags for CI (comma-separated)
  -D, --dockerize         Enable dockerization in CI builds          [boolean]
  -L, --node-docker-tag   Base node docker tag
  -N, --docker-namespace  Registry namespace / repository / ACR name
  -T, --github-token      VCS auth token (any host, not only GitHub)
  -p, --private           Create the repository private             [boolean]
      --dry-run           Print the resolved plan and exit          [boolean]
  -y, --yes               Skip the confirmation prompt              [boolean]
```

## Preview with `--dry-run`

Always safe, makes no changes. Prints the fully-resolved plan — providers, repo
URL, image reference, packages — exactly as it would execute:

```bash
imq service create billing ./billing \
  --vcs gitlab --ci circleci --registry google \
  --project my-proj --region europe-west1 \
  --packages opentelemetry,pg-cache --dry-run -a "My Org" -e dev@my-org.io
```

A dry run makes no network calls, so it does **not** require a VCS namespace or
auth token — those are shown as `<prompted at create>` in the plan. It does
still validate the always-required inputs (author and email). Use it in scripts
and CI to preview a given set of flags before committing to a real run.

## What a run does (pipeline)

When repo creation is enabled (`-g`/`--use-git` or a configured VCS), a full
run performs, in order:

1. **Resolve** the plan from all config layers.
2. **Scaffold** the service from the template (token substitution + addon
   overlays); generate `src/<ServiceClass>.ts` and its test; merge addon
   dependencies.
3. **Write `.imqrc.json`** with the resolved choices (no secrets).
4. **Create** the remote repository on the VCS host.
5. **Provision CI** — enable the repo and set secrets (e.g. GitHub Actions
   sealed secrets, CircleCI env vars, Travis RSA-encrypted vars).
6. Compile the **CI/docker** tokens.
7. **Install** dependencies (`npm install`) unless `--no-install`.
8. **Initialize git** locally (sets a local commit identity from the author/
   email so it works even without a global git identity), **commit**, add the
   **remote**, **push**, and **tag** the initial version.
9. **Report** any addon instructions and environment variables you must set.

Without repo creation, the remote/CI-secret/commit/push steps (4, 5, 8) are
skipped; scaffold, `.imqrc.json`, CI/docker token compilation and install
still run.

### Failure & rollback

- The target directory is only removed on failure if the CLI **created** it —
  a pre-existing directory (or the current/home directory) is never deleted.
  A non-empty target is refused up front unless you pass `--force`.
- If the remote repository was already created when a later step fails, you are
  offered (interactively) to delete it to roll back; non-interactively it is
  left in place with a notice so nothing is destroyed silently.
- Enabling CI and provisioning secrets are **non-fatal**: on failure the CLI
  prints what to do manually and continues. It reports which registry secrets
  were actually provisioned rather than assuming success.

> The generated service targets ESM + TypeScript + the native `node:test`
> runner, matching the current default template. Run `npm test` inside it out
> of the box.

## Non-interactive / CI usage

Provide everything via flags (or config) and add `-y` to skip confirmation. A
real (non-dry-run) create with a VCS host needs an auth token — pass `-T`/
`--vcs-token` (or set `vcs.auth.token` in config):

```bash
imq service create orders ./orders -y \
  -a "My Org" -e dev@my-org.io -l MIT \
  --vcs github -u my-org -T "$GITHUB_TOKEN" --ci github-actions \
  --registry dockerhub -N myorg --no-install
```

## Templates

`--template` accepts a **name** (a bundled or custom template), a **git URL**,
or a **local directory**. With no flag the default template is used, fetched
over public HTTPS and pinned to the `templatesRef` from your config (default
`v4`). See [Custom Templates](Custom-Templates) to build your own.

## The generated `.imqrc.json`

The resolved providers and packages are committed to `.imqrc.json` in the new
service so later commands and re-creations reuse them. Edit it to change a
single service's tools without touching your global defaults — see
[Configuration](Configuration#per-service-overrides-imqrcjson).
