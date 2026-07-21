# Wiki source

This directory holds the source of the **@imqueue/cli GitHub wiki** — the
detailed user manual. Pages use GitHub-wiki conventions (page name = file name
without `.md`, `[[Links]]` are plain `[text](Page)` here, `_Sidebar.md` renders
the navigation).

## Pages

| File | Wiki page |
|---|---|
| `Home.md` | landing page |
| `_Sidebar.md` | sidebar navigation |
| `Installation.md` | install, requirements, upgrading, completions |
| `Configuration.md` | config layers, schema, secrets, env vars |
| `Creating-Services.md` | `imq service create`, the four axes, dry-run |
| `Package-Catalog.md` | addon packages and groups |
| `Providers.md` | VCS / CI / registry providers, enterprise |
| `Managing-Local-Services.md` | `imq ctl` / `imq log` / `imq up` |
| `Clients-and-Versioning.md` | `client generate`, `update-version` |
| `Custom-Templates.md` | template v2 manifest, tokens, writing your own |
| `Real-World-Scenarios.md` | end-to-end walkthroughs |
| `Extensibility.md` | provider model, adding providers, seams |
| `Troubleshooting.md` | common issues |

## Publishing to the GitHub wiki

GitHub wikis are a separate git repository (`<repo>.wiki.git`). To publish:

```bash
# one-time: create the wiki by adding the first page via the GitHub UI, then:
git clone https://github.com/imqueue/cli.wiki.git /tmp/cli.wiki
# copy every page except this meta README (which is not a wiki page)
for f in wiki/*.md; do [ "$(basename "$f")" = README.md ] || cp "$f" /tmp/cli.wiki/; done
cd /tmp/cli.wiki
git add -A
git commit -m "docs: sync wiki from cli repo"
git push
```

Keeping the source here (versioned with the code) lets the manual evolve in the
same pull requests as the features it documents; the copy step above pushes it
to the live wiki.
