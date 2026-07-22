# I Message Queue CLI (@imqueue/cli)

[![Build](https://github.com/imqueue/cli/actions/workflows/build.yml/badge.svg)](https://github.com/imqueue/cli/actions/workflows/build.yml)
[![codebeat badge](https://codebeat.co/badges/0824c9af-d6fa-47ac-bc44-eb51d7b37eba)](https://codebeat.co/projects/github-com-imqueue-cli-master)
[![License](https://img.shields.io/badge/license-GPL-blue.svg)](https://github.com/imqueue/cli/blob/master/LICENSE)

## Why?

Frees you from writing boilerplate when making @imqueue services.

## Documentation

This README is a quick reference. The full user manual is published at
[imqueue.org/cli](https://imqueue.org/cli/) (and mirrored in the
[project wiki](https://github.com/imqueue/cli/wiki)). Commercial licensing &
support: [imqueue.com](https://imqueue.com/). Wiki chapters:

- [Installation](https://github.com/imqueue/cli/wiki/Installation)
- [Configuration](https://github.com/imqueue/cli/wiki/Configuration) — layers, schema, secrets, env vars
- [Creating Services](https://github.com/imqueue/cli/wiki/Creating-Services) — the four axes, dry-run, CI usage
- [Package Catalog](https://github.com/imqueue/cli/wiki/Package-Catalog) · [Providers](https://github.com/imqueue/cli/wiki/Providers) · [Custom Templates](https://github.com/imqueue/cli/wiki/Custom-Templates)
- [Managing Local Services](https://github.com/imqueue/cli/wiki/Managing-Local-Services) — `ctl` / `log` / `up`
- [Real-World Scenarios](https://github.com/imqueue/cli/wiki/Real-World-Scenarios) · [Extensibility](https://github.com/imqueue/cli/wiki/Extensibility) · [Troubleshooting](https://github.com/imqueue/cli/wiki/Troubleshooting)

(The command listings below are abridged; run `imq <command> --help` for the
authoritative, always-current options.)

## Install

As simple as:

~~~bash
npm i -g @imqueue/cli
~~~

## Usage

To start simply run after install:

~~~bash
imq
~~~

@imqueue/cli first of all provides a way to manage your @imqueue/rpc based services and 
clients based on desired configuration.

~~~
@imqueue Command Line Interface

Usage: imq <command>

Commands:
  imq client            Manage @imqueue client
  imq completions       Generates completions script for your shell
  imq config            Manage @imqueue CLI settings
  imq ctl <action>      Start/stop/restart/status a bulk of local services
  imq log [services..]  Tail and combine local service logs
  imq service           Manage @imqueue service
  imq up                Bulk-update service dependencies

Options:
  --version  Show version number                                       [boolean]
  --help     Show help                                                 [boolean]
~~~

> **Upgrading from 3.x:** the standalone `imqctl`, `imqlog` and `imqup` shell
> tools are now native subcommands — `imq ctl`, `imq log` and `imq up`. The
> options are unchanged; see [Controlling Local Services](#controlling-local-services).

> On every interactive run `imq` checks npm for a newer release and offers to
> self-update. Set `IMQ_NO_UPDATE_CHECK=1` to skip that check.

### Service Management

The main essence of this command-line tool is to provide simple way of
creating services based on boilerplate templates.

Service creation is organized around four independent, pluggable axes so you
can mix and match the tools you actually use:

- **VCS host** (`--vcs`): `github` (default), `gitlab`, `bitbucket`
- **CI provider** (`--ci`): `github-actions` (default), `circleci`, `travis`
  (legacy). Choices are filtered to those compatible with the selected host.
- **Container registry** (`--registry`): `dockerhub` (default), `google`
  (Artifact Registry), `aws-ecr`, `azure-acr`
- **Addon packages** (`--packages`): optional secondary @imqueue libraries
  (see [Package Catalog](#package-catalog))

Every option resolves with the precedence **CLI flag → per-service
`.imqrc.json` → global `~/.imq/config.json` → interactive prompt → default**,
so non-interactive runs never hang. It is recommended to run `imq config init`
right after installation to set your defaults.

~~~
imq service create [name] [path]

Creates new service package with the given service name under given path.

Options:
  -a, --author           Service author full name (person or organization)
  -e, --email            Service author's contact email
  -g, --use-git          Turn on automatic repo creation               [boolean]
      --vcs              VCS host: github, gitlab, bitbucket
  -u, --github-namespace VCS namespace (user, organization or workspace)
      --ci               CI provider: github-actions, circleci, travis
      --registry         Container registry: dockerhub, google, aws-ecr,
                         azure-acr
      --region           Registry region (google, aws-ecr)
      --project          GCP project id (google)
      --account-id       AWS account id (aws-ecr)
      --packages         Comma-separated addon packages (--no-packages for none)
      --no-install       Do not install npm packages automatically     [boolean]
  -V, --service-version  Initial service version           [default: "1.0.0-0"]
  -H, --homepage         Homepage URL for service, if required
  -B, --bugs-url         Bugs url for service, if required
  -l, --license          SPDX license name/id or path to a custom license file
  -t, --template         Template name, git url or file system directory
  -d, --description      Service description
  -n, --node-versions    Node version tags for CI builds (comma-separated)
  -D, --dockerize        Enable service dockerization with CI builds   [boolean]
  -L, --node-docker-tag  Node docker tag to use as base docker image
  -N, --docker-namespace Registry namespace / repository / ACR name
  -T, --github-token     VCS auth token
      --git-protocol     Git transport for the initial push: https (default) or
                         ssh                            [choices: "https","ssh"]
  -p, --private          Repository will be private                    [boolean]
      --dry-run          Print the resolved plan and exit              [boolean]
  -y, --yes              Skip the confirmation prompt                  [boolean]
      --name             Service name to create with
      --path             Path to directory where service will be generated to
~~~

Use `--dry-run` to preview the fully-resolved plan (providers, repo url, image
reference, packages) without making any changes — handy for scripting and CI.

The chosen providers and packages are written to a committed `.imqrc.json` in
the generated service, so later commands and re-creations reuse them.

**Git transport for the initial push.** By default (`vcs.protocol: https`) the
initial commit is pushed over HTTPS authenticated with the same access token
that created the repository — the token is used only for that push and is never
written into the repository's `.git/config`. This makes a push to a private
organization repo succeed even when your SSH key (or a different "active"
git/gh account) has no access to it. Pass `--git-protocol ssh` (or set
`vcs.protocol ssh`) to push over SSH with your own keys instead. `imq config
init` auto-detects a sensible default from whether you have SSH keys in
`~/.ssh`. See
[Configuration → Git transport](https://github.com/imqueue/cli/wiki/Configuration#git-transport-for-the-initial-push-https-vs-ssh).

#### Package Catalog

`imq service create --packages <list>` adds secondary @imqueue libraries and
wires them in. The catalog is data (`catalog.json` bundled with the CLI, with
the templates-repo copy preferred when present), so
new addons can be published without a CLI release. Groups marked *exclusive*
allow a single choice:

- **tracing** (exclusive): `dd-trace`, `opentelemetry`
- **orm** (exclusive): `sequelize`, `prisma`
- **features**: `pg-cache`, `pg-pubsub`, `tag-cache`, `job`, `net`,
  `http-protect`, `graphql-dependency`, `type-graphql-dependency`

Each addon merges its dependencies, may inject wiring code at the template's
`%ADDON_PRELOAD` / `%ADDON_CONFIG` points, and prints any required environment
variables after creation.

### Client Management

**Generating Clients:**

To generate a client related service should be started, otherwise generation 
will fail.

This command will expect service name as mandatory option.

Usage:

~~~
imq client generate <name> [path]

Generates @imqueue/rpc client for a specified service

Options:
  --version        Show version number                                 [boolean]
  --help           Show help                                           [boolean]
  -o, --overwrite  Overwrite existing client without prompt            [boolean]
  --path           Directory where client file should be placed   [default: "."]
~~~

### Bulk Version Bump

To release a new version across one or many services under a directory, use:

~~~
imq service update-version <path> [branch]

Updates services under given path with a new version tag and pushes the
changes to their repositories, triggering CI builds.

Options:
  -b, --branch       The branch to checkout and use during update
                                                            [default: "master"]
  -n, --npm-version  NPM version to update
                     (major|minor|patch|prerelease)      [default: "prerelease"]
~~~

For each detected service it runs `git checkout <branch>` → `git pull` →
`npm version <n>` → `git push --follow-tags`, stopping that service on the
first failing step.

### Managing @imqueue/cli Configuration

@imqueue/cli can be used with a pre-configured options to shorten commands usage.
Global base configurations options usually stored in `~/.imq/config.json` file.
This file can be managed manually, but it is recommended to use special
command:

~~~bash
imq config init
~~~

which will guide you through configuration process. When you enable a VCS host
it auto-detects the git transport (SSH if you have keys in `~/.ssh`, otherwise
HTTPS), tells you what it picked, and lets you change it.

There are also useful commands to retrieve and set specific configuration
values, stored in a configuration file:

~~~bash
imq config get
~~~
will print all set configuration options in `option = value` format
(add `-j`/`--json` to print the whole config as JSON).

~~~bash
imq config get [option_name]
~~~
will print a single requested option value.

~~~bash
imq config set [option_name] [new_value]
~~~
will set requested option to a given new value. Nested options can be
addressed with a dot-path, e.g. `imq config set ci.provider circleci`,
`imq config set vcs.namespace my-org` or `imq config set vcs.protocol ssh`.
The config keeps the structured v4 keys (`vcs`, `ci`, `registry`, `packages`,
`templatesRef`) and their legacy equivalents in sync, so upgrading or
downgrading the CLI keeps working. A config written by an older CLI is read
transparently (github + travis + dockerhub).

~~~bash
imq config check
~~~
exits with code `0` if the config is initialized and `1` otherwise, which is
handy in scripts. The config file is written with `0600` permissions since it
may hold secrets (GitHub token, DockerHub password).


### @imqueue/cli Completions For Your Shell

@imqueue/cli supports completions for your shell. It provide a way to generate 
completions script and add it to your shell configuration, as far as
allows to remove previously added completion script just running the 
corresponding commands:

~~~bash
imq completions on
imq completions off
~~~

Currently it supports both `zsh` and `bash` shells.

## Controlling Local Services

For comfortable local development @imqueue provides couple of useful 
command-line tools, allowing developers to manage local set of services.
Like starting/stopping/restarting them with a single command line or managing
services logs.

Please, note, there are many different ways to manage local services.
You may consider pulling and starting pre-build docker images, or even
use docker compose for managing them, or may utilize such tools as
vagrant to organize local environment setup. BTW, you may suggest to 
run your services locally on host OS, which is really useful scenario
during development and the tools below will dramatically improve your
experience, especially, when the number of services to manage significant.

`imq ctl` and `imq up` share the same **service discovery**: when `-s` is
omitted they scan the given path for immediate sub-directories whose `src/`
tree contains a class extending `IMQService` or `IMQClient`. `imq log` works
off the `*.log` files already collected under `~/.imq/var` (per-service logs
and process ids live there).

### imq ctl

Starts, stops, restarts or reports status of a bulk of local services. On
start each service is launched via its `npm run dev` script in its own process
group (output redirected to `~/.imq/var/<service>.log`, truncated per run); a
service already running is skipped (use `restart`). Stop terminates the whole
process group and runs each service's `npm run stop` script.

~~~
imq ctl <action> [-p path] [-s services] [-ucv]

  <action>          one of start | stop | restart | status
  -p, --path        directory with the service repositories (default: cwd)
  -s, --services    comma-separated service names (skips discovery)
  -u, --update      run 'git pull' on each service before starting
  -c, --calm        calm start - wait for each service to become ready
                    (log line "reader channel connected") before the next;
                    a service that crashes on startup is reported at once
  -v, --verbose     show command execution time
~~~

`imq ctl status` lists each tracked service and whether its recorded pid is
live or stale.

### imq log

Combines and tails the logs collected by `imq ctl`. With no service names all
available logs are combined; lines are prefixed with a coloured `[service]`
tag when more than one log is shown.

~~~
imq log [services..] [-cfP]

  [services..]      service names to combine logs for (default: all)
  -c, --clean       delete collected logs and exit (scoped to the named
                    services, or all logs when none are named)
  -f, --follow      follow appended data (default: true; --no-follow to
                    dump current logs and exit)
      --no-prefix   do not prefix log lines with the service name (-P for short)
~~~

### imq up

Updates dependencies of local services (via `npm-check-updates`, installed
automatically if missing) and, optionally, version-bumps, commits and pushes
them. Make sure the services are not in a dirty git state before running an
update.

~~~
imq up [-p path] [-s services] [-v type] [-cu]

  -p, --path         directory with the service repositories (default: cwd)
  -s, --services     comma-separated service names (skips discovery)
  -v, --npm-version  version bump on commit: major|minor|patch|prerelease
                     (default: prerelease; also --bump)
  -c, --commit       commit, version-bump and push the update
  -u, --skip-update  skip the dependency update, perform other tasks only
~~~

For each service the update runs `git pull` → `ncu -u` → reinstall, then (with
`-c`) commits `chore: dependencies update`, runs `npm version <type>` and
`git push --follow-tags` — but only when the working tree actually changed. A
step that fails aborts that service (before any destructive step) and is
reported in a summary; the command exits non-zero if any service failed.

## License

This project is licensed under the GNU General Public License v3.0.
See the [LICENSE](LICENSE)
