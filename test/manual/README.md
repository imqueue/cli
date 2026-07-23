# Manual test checklist

A click-through checklist for a manual QA pass of the `imq` CLI — the
counterpart to the automated suite (`npm test`). It comes in two equivalent
forms; use whichever you prefer:

| File | Best for |
|---|---|
| [`test-checklist.html`](test-checklist.html) | interactive use — clickable Pass/Fail, saved progress, copy-command buttons |
| [`test-checklist.md`](test-checklist.md) | plain text — read in any editor, tick `- [ ]` boxes, or diff/commit a filled-in copy |

Both cover the same tests; pick one per session.

## HTML version (interactive)

Open the file in a browser (no server needed):

```bash
xdg-open test/manual/test-checklist.html   # Linux
open     test/manual/test-checklist.html   # macOS
```

- Click **Pass** / **Fail** on each test; failing a test reveals a notes box.
- Each command has a **copy** button — paste it into a terminal.
- Progress is saved in the browser (localStorage), so you can close and resume.
- **Copy results** produces a markdown summary you can paste into an issue, a PR,
  or a chat with an assistant; **Download .md** saves the same to a file.
- **Reset** clears all marks; **◐ Theme** toggles light/dark.

## Markdown version (plain text)

Open [`test-checklist.md`](test-checklist.md) in any editor. Tick a box `- [x]`
when a test passes; if it fails, leave it unchecked and fill the `↳ Notes:`
line. Copy the file first if you want to keep a filled-in record of a session.

## What it covers

Sandbox setup (isolated `~/.imq`) plus every command group: global/branding,
`config` (including git-transport auto-detection and `vcs.protocol`),
`service packages`, `service create --dry-run` (axes, precedence, guards, the
HTTPS/SSH `--git-protocol`), real repo creation (token-authenticated HTTPS push
and the rollback prompt), `ctl`/`log`/`up` fleet lifecycle, `client generate`,
`service update-version`, `completions`, config security / v3 back-compat, and
legacy (v1) template back-compat (self-contained OpenTelemetry preload + merged,
non-clobbering `tsconfig.json` for pg-prisma/validation).
Sections are tagged **offline** / **net** / **redis** / **tty** so you can run
the fast offline pass first and skip what needs external services.

The checklist is static content — it is ignored by the automated runner
(`find test -name '*.spec.js'`), so it never affects `npm test`.
