# Manual test checklist

`test-checklist.html` is a self-contained, click-through checklist for a manual
QA pass of the `imq` CLI — the counterpart to the automated suite (`npm test`).

## Use it

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

## What it covers

Sandbox setup (isolated `~/.imq`) plus every command group: global/branding,
`config`, `service packages`, `service create --dry-run` (axes, precedence,
guards), `ctl`/`log`/`up` fleet lifecycle, `client generate`,
`service update-version`, `completions`, and config security / v3 back-compat.
Sections are tagged **offline** / **net** / **redis** / **tty** so you can run
the fast offline pass first and skip what needs external services.

The checklist is static content — it is ignored by the automated runner
(`find test -name '*.spec.js'`), so it never affects `npm test`.
