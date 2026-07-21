# Configuration

The CLI reads configuration from three layers, merged with a strict precedence
so that scripted runs are deterministic:

```
CLI flag  →  per-service .imqrc.json  →  global ~/.imq/config.json  →  interactive prompt (TTY only)  →  built-in default
```

A prompt is only shown when the process is attached to a TTY and no earlier
layer supplied a value; otherwise the default is used, or — for a required
value with no default (author, email, and a VCS namespace/token on a real
create) — the command fails fast with a clear error instead of hanging. This
is what lets `imq service create … --dry-run` and CI pipelines run without
blocking on input.

## Quick start

```bash
imq config init
```

An interactive wizard walks you through the four axes and stores your answers
globally. Do this once after installation to make later commands short. When
you enable a VCS host, the wizard **auto-detects the git transport**: it
defaults to `ssh` if you have SSH keys in `~/.ssh` (overridable with
`IMQ_SSH_DIR`) and `https` otherwise, reports which it picked and why, and lets
you change it — see [Git transport](#git-transport-for-the-initial-push-https-vs-ssh).

## Managing config values

```bash
imq config get                 # print every set option as "key = value"
imq config get --json          # print the whole config as JSON (-j for short)
imq config get ci.provider     # print a single value
imq config set ci.provider circleci
imq config set vcs.namespace my-org
imq config set packages opentelemetry,pg-cache   # comma list OR a JSON array
imq config set vcs.provider giturb       # rejected: prints the valid list
imq config check               # exit 0 if initialized, 1 otherwise (for scripts)
```

`get`/`set` accept **dot-paths** into the structured config (e.g.
`registry.region`, `vcs.auth.token`). The file is written with `0600`
permissions because it may hold secrets (VCS token, registry password).
Setting a structured key (`vcs.*`, `ci.*`, `registry.*`, `packages`,
`templatesRef`) also updates the mapped legacy keys, so a config written by v4
still works if the CLI is downgraded to v3.

## The structured (v4) schema

`~/.imq/config.json` holds a structured view built from these groups:

### `vcs` — version control host

| Key | Meaning |
|---|---|
| `vcs.provider` | `github` \| `gitlab` \| `bitbucket` |
| `vcs.namespace` | user / organization / workspace that owns new repos |
| `vcs.private` | create repositories as private (`true`/`false`) |
| `vcs.protocol` | git transport for the create-time push: `https` (default) \| `ssh` |
| `vcs.auth.token` | API/personal-access token for repo creation & secrets |

### `ci` — continuous integration

| Key | Meaning |
|---|---|
| `ci.provider` | `github-actions` \| `circleci` \| `travis` |
| `ci.auth.token` | token used to enable the repo / set CI secrets (CircleCI, Travis) |

### `registry` — container registry

| Key | Meaning |
|---|---|
| `registry.provider` | `dockerhub` \| `google` \| `aws-ecr` \| `azure-acr` |
| `registry.namespace` | image namespace / repository / ACR name |
| `registry.region` | region (Google Artifact Registry, AWS ECR) |
| `registry.project` | GCP project id (Google) |
| `registry.accountId` | AWS account id (ECR) |
| `registry.auth.user` / `registry.auth.password` | registry credentials (DockerHub) |

### Top-level

| Key | Meaning |
|---|---|
| `packages` | default addon packages added to new services (array) |
| `templatesRef` | git ref of the templates repo to use (default `master`) |

Example `~/.imq/config.json`:

```json
{
  "vcs":      { "provider": "github", "namespace": "my-org", "private": true },
  "ci":       { "provider": "github-actions" },
  "registry": { "provider": "google", "project": "my-gcp-proj", "region": "europe-west1" },
  "packages": ["opentelemetry", "pg-cache"],
  "templatesRef": "master"
}
```

## Per-service overrides: `.imqrc.json`

When a service is created, its resolved providers and packages are written to a
committed `.imqrc.json` at the service root. Later commands (and re-creations)
read it, so a service always rebuilds with the tools it was born with — even if
your global defaults have since changed. A `.imqrc.json` value overrides the
global config but is still overridden by an explicit CLI flag.

```json
{
  "vcs": { "provider": "gitlab", "namespace": "team-x" },
  "ci":  { "provider": "circleci" },
  "packages": ["sequelize", "tag-cache"]
}
```

## Secrets and tokens

Tokens can be provided by (in order of preference):

1. A CLI flag for one-off use: `-T, --github-token <token>` (used for any VCS
   host, not only GitHub).
2. The config: `vcs.auth.token`, `ci.auth.token`, `registry.auth.password`.
3. An interactive prompt.

Because the config file may contain these, it is always written `0600`. Prefer
per-invocation flags or environment injection in shared CI environments.

## Git transport for the initial push (HTTPS vs SSH)

When `imq service create` commits and pushes the new repository, it uses one of
two transports, selected by `vcs.protocol` (or the `--git-protocol` flag):

| `vcs.protocol` | Push behavior |
|---|---|
| `https` (**default**) | Push over `https://…` **authenticated with the access token** that created the repo. The token is used **only for that push** (via an ephemeral `http.extraHeader`) and is never written into the repository's `.git/config`, which keeps a clean, token-free remote URL. |
| `ssh` | Push over the host's `git@…:…` SSH URL using **your own SSH keys/agent**. No token is injected — you need working SSH access to the namespace. |

Precedence is the usual one: `--git-protocol` flag → `.imqrc.json` →
global config → the `https` default.

**Why HTTPS is the default.** The access token that just created the repo is
guaranteed to have write access, so the push succeeds even for a private
organization repo where your SSH key — or a *different* "active" git/gh
account — has no access (the classic misleading `Repository not found` on
push). Choose `ssh` when you specifically rely on SSH keys (e.g. org policy,
hardware-key signing, or an SSH-only host):

```bash
imq config set vcs.protocol ssh        # make ssh the default for new services
imq service create my-svc ./my-svc --git-protocol https   # or override per run
```

> `IMQ_GIT_REMOTE_BASE` still overrides the push target entirely (custom /
> self-hosted git or integration testing) and takes precedence over
> `vcs.protocol`; no token is injected in that mode.

## Backward compatibility

A configuration written by 3.x uses legacy keys (`gitBaseUrl`,
`gitHubAuthToken`, `gitRepoPrivate`, `useGit`, `useDocker`,
`dockerHubNamespace`, `dockerHubUser`, `dockerHubPassword`). The CLI:

- **reads** them transparently and derives an equivalent structured view
  (github + travis + dockerhub, namespace parsed from `gitBaseUrl`);
- **writes** both the structured keys *and* their legacy equivalents, so a
  config remains usable if you downgrade the CLI.

You do not need to migrate anything by hand.

## Environment variable reference

| Variable | Effect |
|---|---|
| `IMQ_CLI_HOME` | Base for `~/.imq` (sandboxing / CI). |
| `IMQ_NO_UPDATE_CHECK` | Skip the npm self-update check. |
| `IMQ_TEMPLATES_REPO` | Override the templates git URL (fork or SSH). |
| `IMQ_GITHUB_API_URL` | GitHub API base — set to a GitHub Enterprise host. |
| `IMQ_GITLAB_API_URL` | GitLab API base — self-managed GitLab. |
| `IMQ_BITBUCKET_API_URL` | Bitbucket API base — a Bitbucket Cloud 2.0-compatible endpoint. |
| `IMQ_CIRCLECI_API_URL` | CircleCI API base. |
| `IMQ_TRAVIS_API_URL` | Travis API base. |
| `IMQ_GIT_REMOTE_BASE` | Base for the git remote used on commit/push (testing seam). |
| `IMQ_SSH_DIR` | SSH directory inspected for keys when auto-detecting the git transport (defaults to `~/.ssh`). |
| `CIRCLE_TOKEN` | CircleCI token fallback (used when `ci.auth.token` is unset). |

These are also the seams used by the test harness; in production they enable
enterprise / self-hosted deployments without any code change. See
[Providers](Providers#enterprise--self-hosted) and
[Extensibility](Extensibility).

### Cloud-registry credentials (read at create time)

When a service is dockerized against a cloud registry, `imq service create`
reads the following from the invoking environment and provisions them as CI
secrets on the new repository. If a variable is unset, **no secret is
provisioned** for it — the CLI reports which secrets were and weren't set, and
the CI's `docker login` will fail until you add them manually.

| Registry | Environment variables |
|---|---|
| `google` (Artifact Registry) | `GCP_SA_KEY` (service-account JSON key) |
| `aws-ecr` | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |
| `azure-acr` | `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` |

Docker Hub credentials come from `registry.auth.user`/`registry.auth.password`
(config) or an interactive prompt instead.
