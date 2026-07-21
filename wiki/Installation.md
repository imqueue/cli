# Installation

## Requirements

- **Node.js ≥ 22.12.0** (the CLI is ESM and uses modern Node APIs).
- **git** on your `PATH` (used for repo creation, commits, template fetch).
- A running **Redis** if you intend to generate clients from live services or
  run services locally.
- Optional, per feature:
  - An SSH key **or** nothing special — templates are fetched over public
    HTTPS by default.
  - `npm-check-updates` — installed automatically by `imq up` if missing.
  - Docker — only if you enable service dockerization.

## Install globally

```bash
npm i -g @imqueue/cli
```

Verify:

```bash
imq --version
imq --help
```

Running `imq` with no arguments prints the command list.

## Upgrading

```bash
npm i -g @imqueue/cli@latest
```

On every interactive run the CLI checks npm for a newer release and offers to
self-update. To disable that check (e.g. in CI or slow networks):

```bash
export IMQ_NO_UPDATE_CHECK=1
```

### Upgrading from 3.x

The three standalone shell tools were folded into the `imq` binary. Update any
scripts or aliases:

| 3.x | 4.x |
|---|---|
| `imqctl start …` | `imq ctl start …` |
| `imqlog …` | `imq log …` |
| `imqup …` | `imq up …` |

All options are unchanged. Your existing `~/.imq/config.json` continues to work
untouched — see [Configuration](Configuration#backward-compatibility).

## Shell completions

The CLI can install completion scripts for **bash** and **zsh**:

```bash
imq completions on     # append the completion block to ~/.bashrc or ~/.zshrc
imq completions off    # remove it
```

Then reload your shell or `source ~/.bashrc` (or `~/.zshrc`). The shell is
detected from your login shell, not from transient `ZSH_*` variables, so it
behaves correctly inside subshells.

## Files the CLI creates

| Path | Purpose |
|---|---|
| `~/.imq/config.json` | Global configuration (written `0600` — may hold secrets). |
| `~/.imq/templates/` | Cached clone of the templates repo. |
| `~/.imq/custom-templates/` | Named custom templates you add. |
| `~/.imq/var/` | Runtime state for `imq ctl`/`imq log`: `*.log` and `.pids`. |

Override the base directory (useful for sandboxing or CI) with:

```bash
export IMQ_CLI_HOME=/some/where   # ~/.imq becomes /some/where/.imq
```

## Uninstall

```bash
npm r -g @imqueue/cli
rm -rf ~/.imq            # optional: remove cached templates, config, logs
```
