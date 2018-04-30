# I Message Queue Cli (imq-cli)

[![Build Status](https://travis-ci.org/imqueue/imq-cli.svg?branch=master)](https://travis-ci.org/imqueue/imq-cli)
[![codebeat badge](https://codebeat.co/badges/bafe0c12-51c6-4419-b671-cf107b5293e3)](https://codebeat.co/projects/github-com-imqueue-imq-cli-master)
[![Coverage Status](https://coveralls.io/repos/github/imqueue/imq-cli/badge.svg?branch=master)](https://coveralls.io/github/imqueue/imq-cli?branch=master)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](https://rawgit.com/imqueue/imq-cli/master/LICENSE)

## Why?

IMQ-CLI makes work with imq-rpc simplier.	Frees you from writing boilerplate.

## Usage

### Client generation

To generate client for service Test in current dir just specify the service Name.

~~~sh
# imq client generate Test
~~~

To specify the out folder you should use second paramenter.

~~~sh
# imq client generate Test /tmp
~~~

Use option "-o" to overwrite out file anyway....

~~~sh
# imq client generate -o Test /tmp
~~~

Coming soon...
