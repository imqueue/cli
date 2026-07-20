# I Message Queue CLI (@imqueue/cli)

[![Build](https://github.com/imqueue/cli/actions/workflows/build.yml/badge.svg)](https://github.com/imqueue/cli/actions/workflows/build.yml)
[![codebeat badge](https://codebeat.co/badges/0824c9af-d6fa-47ac-bc44-eb51d7b37eba)](https://codebeat.co/projects/github-com-imqueue-cli-master)
[![License](https://img.shields.io/badge/license-GPL-blue.svg)](https://rawgit.com/imqueue/cli/master/LICENSE)

## Why?

Frees you from writing boilerplate when making @imqueue services.

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

IMQ-CLI first of all provides a way to manage your IMQ-RPC based services and 
clients based on desired configuration.

~~~
IMQ Command Line Interface

Usage: imq <command>

Commands:
  imq client       Manage IMQ client
  imq completions  Generates completions script for your shell
  imq config       Manage IMQ CLI settings
  imq service      Manage IMQ service

Options:
  --version  Show version number                                       [boolean]
  --help     Show help                                                 [boolean]
~~~

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

#### Package Catalog

`imq service create --packages <list>` adds secondary @imqueue libraries and
wires them in. The catalog is data (`catalog.json` in the templates repo), so
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

Generates IMQ-RPC client for a specified service

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

### Managing IMQ-CLI Configuration

IMQ-CLI can be used with a pre-configured options to shorten commands usage.
Global base configurations options usually stored in `~/.imq/config.json` file.
This file can be managed manually, but it is recommended to use special
command:

~~~bash
imq config init
~~~

which will guide you through configuration process.

There are also useful commands to retrieve and set specific configuration
values, stored in a configuration file:

~~~bash
imq config get
~~~
will print all upset configuration options in `option = value` format.

~~~bash
imq config get [option_name]
~~~
will print a single requested option value.

~~~bash
imq config set [option_name] [new_value]
~~~
will set requested option to a given new value. Nested options can be
addressed with a dot-path, e.g. `imq config set ci.provider circleci` or
`imq config set vcs.namespace my-org`. The config keeps the structured v4
keys (`vcs`, `ci`, `registry`, `packages`, `templatesRef`) and their legacy
equivalents in sync, so upgrading or downgrading the CLI keeps working. A
config written by an older CLI is read transparently (github + travis +
dockerhub).

~~~bash
imq config check
~~~
exits with code `0` if the config is initialized and `1` otherwise, which is
handy in scripts. The config file is written with `0600` permissions since it
may hold secrets (GitHub token, DockerHub password).


### IMQ-CLI Completions For Your Shell

IMQ-CLI supports completions for your shell. It provide a way to generate 
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

### imqctl

~~~
Usage: imqctl <command> [-p path] [-s services] [-hu]
  <command> is one of start|stop|restart
  [-p path] - path to a directory with services repositories, by default is 
              current directory
  [-s services] - comma-separated services list (repositories names),
                  if not passed will scan path for a services presence
  [-u] - if passed service will be updated using 'git pull' before start
  [-c] - calm down services start - wait before staring next
  [-v] - verbose mode, shows command execution time
  [-h] - print this usage information
~~~

### imqlog

~~~
Usage: imqlog [-hc] [service1, ...serviceN]
  [service1, ...serviceN] - list of service repositories directories names to 
                            combine logs for, if omitted all existing logs are
                            combined.
  [-c] - clean previous logs
  [-h] - print this usage information
~~~

### imqup

~~~
Usage: imqup [-hcu] [-p path] [-s services] [-v type]
  Performs a dependencies update on services located under a given path.
  Before running, make sure the services are not in a dirty git state.
  [-p path] - path to a directory with services repositories, by default is
              current directory
  [-s services] - comma-separated services list (repositories names),
                  if not passed will scan path for a services presence
  [-v type] - new version to set: major|minor|patch|prerelease (default: prerelease)
  [-c] - commit and push the update
  [-u] - do NOT update dependencies, perform other tasks only
  [-h] - print this usage information
~~~

## License

This project is licensed under the GNU General Public License v3.0.
See the [LICENSE](LICENSE)
