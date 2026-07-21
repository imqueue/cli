# Providers

Service creation composes four axes through a typed provider registry. This
page details each provider, the credentials it needs, and how CI and registry
providers combine.

## VCS hosts (`--vcs`)

| Provider | Namespace means | Token | API base override |
|---|---|---|---|
| **github** (default) | user or organization | Personal Access Token with `repo` scope (and `admin:org` for org repos / Actions secrets) | `IMQ_GITHUB_API_URL` |
| **gitlab** | user or group | Personal Access Token with `api` scope | `IMQ_GITLAB_API_URL` |
| **bitbucket** | workspace | Bitbucket **Cloud** access token (repo admin), sent as a Bearer token | `IMQ_BITBUCKET_API_URL` |

The VCS provider is responsible for **creating the remote repository** and,
where applicable, storing CI secrets. The SCM tool (git) is deliberately split
from the host, so the same git commit/push flow serves all three (and other
SCMs could be added later).

Provide the token with `-T/--github-token` (works for any host) or via
`vcs.auth.token` in the config.

## CI providers (`--ci`)

| Provider | Secret mechanism | Token | API base override |
|---|---|---|---|
| **github-actions** (default) | libsodium **sealed-box** secrets via the GitHub API | GitHub token (same as VCS) | `IMQ_GITHUB_API_URL` |
| **circleci** | project environment variables via the CircleCI API | CircleCI token | `IMQ_CIRCLECI_API_URL` |
| **travis** (legacy) | RSA (PKCS1) **secure** variables | Travis token | `IMQ_TRAVIS_API_URL` |

CI choices are filtered to those compatible with the chosen VCS host (e.g.
GitHub Actions requires GitHub). `travis` is kept working for existing setups
but is not recommended for new services.

## Container registries (`--registry`)

| Provider | Extra inputs | Notes |
|---|---|---|
| **dockerhub** (default) | `registry.auth.user` / `password`, `-N` namespace | classic Docker Hub |
| **google** | `--project`, `--region` | **Artifact Registry** (not the retired GCR) |
| **aws-ecr** | `--account-id`, `--region` | Amazon ECR |
| **azure-acr** | `-N` ACR name | Azure Container Registry |

## How CI and registry compose

Rather than hand-writing an M×N matrix of "CI provider × registry" build
scripts, the CLI composes them through a small set of **generic shell-snippet
tokens** that the CI template fills from the registry provider:

- `%REGISTRY_LOGIN` — the login command(s) for the chosen registry
- `%REGISTRY_PUSH` — the push command(s)
- `%IMAGE_REF` — the fully-qualified image reference
- `%DOCKER_NAMESPACE` / `%DOCKER_SECRETS` — namespace and required secret names
- `%GHA_NODE_MATRIX` / `%GHA_SECRETS_ENV` / `%TRAVIS_NODE_TAG` — CI-specific
  rendering of node versions and secrets

This keeps the number of moving parts at **M + N** instead of **M × N**: add a
registry and every CI provider can push to it; add a CI provider and it can
push to every registry.

## Enterprise / self-hosted

Every provider's API base URL is overridable, which turns the built-in
providers into enterprise-ready ones with no code change:

```bash
# GitHub Enterprise Server
export IMQ_GITHUB_API_URL=https://github.mycorp.com/api/v3
# self-managed GitLab
export IMQ_GITLAB_API_URL=https://gitlab.mycorp.com/api/v4
# an API-compatible Bitbucket endpoint / proxy
export IMQ_BITBUCKET_API_URL=https://bitbucket.mycorp.com/api/2.0
```

> The override relocates the API **base URL** only; it does not translate
> between API dialects. The GitHub and GitLab providers speak the same API
> shape as their enterprise/self-managed servers, so those work directly. The
> Bitbucket provider speaks the **Bitbucket Cloud 2.0** API; point the override
> at a Cloud-2.0-compatible endpoint (Bitbucket Server/Data Center's 1.0 API is
> a different dialect and is not supported as-is).

Combine with `IMQ_GIT_REMOTE_BASE` if your git remote host differs from the API
host. These same variables are how the test suite exercises the providers
against mock servers — see [Extensibility](Extensibility).

## Tokens: where they come from

For any provider token the resolution order is:

1. `-T/--github-token` flag (one-off; applies to the active VCS host)
2. config: `vcs.auth.token`, `ci.auth.token`, `registry.auth.password`
3. for CircleCI, the `CIRCLE_TOKEN` environment variable (fallback for
   `ci.auth.token`)
4. interactive prompt (TTY only)

A legacy `gitHubAuthToken` from a v3 config is only reused for the **github**
host, never for gitlab/bitbucket.

Because the config may store these, `~/.imq/config.json` is always written
`0600`. In shared CI, prefer passing tokens per-invocation or via environment
injection rather than persisting them.
