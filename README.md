# I Message Queue Cli (imq-cli)

[![Build Status](https://travis-ci.org/imqueue/imq-cli.svg?branch=master)](https://travis-ci.org/imqueue/imq-cli)
[![codebeat badge](https://codebeat.co/badges/bafe0c12-51c6-4419-b671-cf107b5293e3)](https://codebeat.co/projects/github-com-imqueue-imq-cli-master)
[![Coverage Status](https://coveralls.io/repos/github/imqueue/imq-cli/badge.svg?branch=master)](https://coveralls.io/github/imqueue/imq-cli?branch=master)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](https://rawgit.com/imqueue/imq-cli/master/LICENSE)

***ATTENTION:** This package is unstable and still in development. Some of the
features may not work or may work with problems.*

## Why?

IMQ-CLI makes work with imq-rpc simpler. Frees you from writing boilerplate.

## Usage

IMQ-CLI first of all provides a way to manage your IMQ-RPC based services and 
clients based on desired configuration.

~~~bash
IMQ Command Line Interface
Version: 1.0.0-dev

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

### Service Management

Coming soon...

### Client Management

**Generating Clients:**

To generate a client related service should be started, otherwise generation 
will fail.

This command will expect service name as mandatory option.

Usage:

~~~bash
imq client generate <name> [path]

Generates IMQ-RPC client for a specified service

Options:
  --version        Show version number                                 [boolean]
  --help           Show help                                           [boolean]
  -o, --overwrite  Overwrite existing client without prompt            [boolean]
  --path           Directory where client file should be placed   [default: "."]
~~~

**Patching Existing Clients:**

Coming soon...

### Managing IMQ-CLI Configuration

Coming soon...

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
