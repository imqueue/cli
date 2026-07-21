# Custom Templates

Templates are the boilerplate `imq service create` clones and compiles into a
new service. You can use the built-in default, a published template, or your
own — pointed at by name, git URL, or local path.

## Selecting a template

`--template` (`-t`) accepts:

| Form | Example |
|---|---|
| **name** | `-t default` (bundled or a named custom template in `~/.imq/custom-templates`) |
| **git URL** | `-t https://github.com/my-org/imq-template.git` |
| **local directory** | `-t ./my-template` |

With no flag, the default template is fetched over public **HTTPS** and pinned
to the `templatesRef` from your config (default `master`). Override the source repo
entirely with `IMQ_TEMPLATES_REPO` (e.g. your fork, or an SSH URL for
contributors):

```bash
export IMQ_TEMPLATES_REPO=git@github.com:my-org/templates.git
imq config set templatesRef main
```

## Template versions (v1 vs v2)

A template is **v2** when it contains an `imq-template.json` manifest;
otherwise it is treated as legacy **v1**. New templates should be v2.

### The manifest — `imq-template.json`

```json
{
  "version": 2,
  "description": "My org's @imqueue service template (ESM, TS, node:test)",
  "ciFiles": "provider"
}
```

| Field | Meaning |
|---|---|
| `version` | manifest version — `2` for the current format |
| `description` | human-readable description |
| `ciFiles` | documents that CI files are emitted by the selected CI provider (rather than shipped in the template). This is descriptive: **any** v2 template gets provider-emitted CI files - the field is not a switch |

An absent or unreadable manifest → the template is compiled as v1.

## Token substitution

Every file under the template is compiled: `%TOKEN` placeholders are replaced.
The base tokens available to template files:

| Token | Replaced with |
|---|---|
| `%SERVICE_NAME` | the service name |
| `%SERVICE_CLASS_NAME` | the generated service class name |
| `%SERVICE_VERSION` | the initial version |
| `%SERVICE_DESCRIPTION` | the service description |
| `%SERVICE_AUTHOR_NAME` / `%SERVICE_AUTHOR_EMAIL` | author name / `<email>` |
| `%SERVICE_REPO` / `%SERVICE_HOMEPAGE` / `%SERVICE_BUGS` | package.json repository / homepage / bugs fragments (from the VCS host) |
| `%LICENSE_HEADER` / `%LICENSE_TEXT` / `%LICENSE_NAME` / `%LICENSE_TAG` | the license header block / full text / name / SPDX tag |
| `%ADDON_PRELOAD` | addon early-init snippets (empty when no addons) |
| `%ADDON_CONFIG` | addon configuration snippets (empty when no addons) |

A token value is inserted verbatim, so `$` characters in an author name or
license text are safe.

Provider/registry/CI composition tokens (filled from the chosen providers) are
also available in CI/Docker files — see
[Providers](Providers#how-ci-and-registry-compose): `%IMAGE_REF`,
`%REGISTRY_LOGIN`, `%REGISTRY_PUSH`, `%DOCKER_NAMESPACE`, `%DOCKER_SECRETS`,
`%GHA_NODE_MATRIX`, `%GHA_SECRETS_ENV`, `%TRAVIS_NODE_TAG`.

Package metadata fragments (repository, homepage, bugs) are derived and
injected into `package.json` from the resolved VCS host and the `-H`/`-B`
flags.

## Addon token points

For a template to support the [Package Catalog](Package-Catalog), place the two
addon anchors where addon code should land — typically:

- `%ADDON_PRELOAD` near the top of the entry file (`index.ts`), before other
  imports, for things like a tracing bootstrap;
- `%ADDON_CONFIG` inside the service setup (`config.ts`), for configuration
  wiring.

When no addons are selected, both compile to empty strings, so a template with
these anchors still produces clean output.

## Fragment overlays

Beyond whole-file compilation, providers and addons can **overlay file
fragments** onto the scaffolded service (writing or replacing specific files by
relative path). This is how a CI provider contributes its workflow file and how
an addon contributes any extra files it needs — without the base template
having to know about every provider or package.

## Writing your own template

1. Start from the default template (clone the templates repo, copy `default/`).
2. Keep or add `imq-template.json` (`version: 2`).
3. Author your files with `%TOKEN` placeholders; put `%ADDON_PRELOAD` /
   `%ADDON_CONFIG` where addon code should go.
4. Keep CI files out of the template if you want provider-emitted CI
   (`"ciFiles": "provider"`).
5. Point the CLI at it:
   ```bash
   imq service create demo ./demo -t ./path/to/my-template --dry-run
   ```
   Iterate with `--dry-run` and local scaffolding until happy.
6. Publish by hosting the template in a git repo and sharing the URL, or drop
   it in `~/.imq/custom-templates/<name>` and refer to it by `<name>`.

## Adapting to an existing project

You are not limited to greenfield services. Because a template is just a
directory of files with tokens, you can encode your organization's
conventions — lint config, tsconfig, Dockerfile, CI, license header, base
dependencies, even a house `%ADDON_CONFIG` — into a custom template so every
new service is born consistent with the rest of your codebase. Combine with a
default `packages` list and a configured VCS/CI/registry to make
`imq service create <name> -y` produce a fully wired, on-brand service in one
command.
