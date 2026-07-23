# @imqueue/cli — Local Manual Test Plan (v4)

> **Purpose:** verify every feature of the locally-linked `imq` (`npm link`) end-to-end
> before merge/publish. This checklist is committed to the repo so it can be
> re-used for every manual testing session; run it against a throwaway sandbox
> (section 0) so your real config is never touched.
>
> **How to use:**
> - Work top-to-bottom. Each test is a checkbox.
> - **Pass** → tick the box `- [x]`.
> - **Fail** → leave it `- [ ]` and fill the `↳ Notes:` line with what went wrong (paste output).
> - "Expect" describes the intended behaviour; if reality differs, that's a fail.
> - Tests marked **[offline]** need nothing external. **[net]** needs internet + a token.
>   **[redis]** needs a running service + Redis. Skip the external ones if you only want the fast pass.

## Results summary (fill at the end)

- Core offline sections (1–4, 6–8, 11–13): ______ / ______ passed
- Optional / net (5, 9, 10, T13.7): ______ / ______ passed
- Blocking problems found: ______________________________________________

---

## 0. Sandbox setup (do this once, keep the SAME terminal open)

Everything below runs against a throwaway `~/.imq` and scratch dirs so your real config is untouched.

```bash
# isolate config/runtime state and silence the update check
export IMQ_CLI_HOME="$(mktemp -d)"        # ~/.imq → $IMQ_CLI_HOME/.imq
export IMQ_NO_UPDATE_CHECK=1
export SBX="$(mktemp -d)"                  # scratch workspace for services
echo "IMQ_CLI_HOME=$IMQ_CLI_HOME"; echo "SBX=$SBX"
which imq && imq --version                 # sanity: should print 4.0.0
```

- [ ] **T0.1 [offline]** `which imq` resolves and `imq --version` prints `4.0.0`.
  ↳ Notes:

> If a later section opens a new terminal, re-run the four `export` lines first.

---

## 1. Global smoke & branding

- [ ] **T1.1 [offline]** `imq --version` → `4.0.0`.
  ↳ Notes:
- [ ] **T1.2 [offline]** `imq --help` → banner first line is exactly `@imqueue Command Line Interface`; the command list shows `Manage @imqueue client`, `Manage @imqueue CLI settings`, `Manage @imqueue service`, and `... @imqueue services ...` for `ctl`/`log`/`up`. **No bare `IMQ` anywhere.**
  ↳ Notes:
- [ ] **T1.3 [offline]** `imq` (no args) → prints help and exits **non-zero** (demands a command).
  ↳ Notes:
- [ ] **T1.4 [offline]** `imq bogus` → error about unknown command (strict mode), non-zero exit.
  ↳ Notes:
- [ ] **T1.5 [offline]** `imq service create --frobnicate x` → rejects the unknown option (strict), non-zero.
  ↳ Notes:
- [ ] **T1.6 [offline]** `imq client generate --help` → describes `Generates @imqueue/rpc client for a specified service` (not `IMQ-RPC`).
  ↳ Notes:
- [ ] **T1.7 [offline]** Brand sweep across all help text:
  ```bash
  for c in "" "client" "client generate" "config" "config init" "config get" "config set" \
           "service" "service create" "service packages" "service update-version" \
           "ctl" "log" "up" "completions"; do imq $c --help 2>&1; done \
    | grep -nE "\bIMQ\b|IMQ-CLI|IMQ-RPC|IMQ service|IMQ client" || echo "CLEAN — no obsolete brand"
  ```
  Expect: prints `CLEAN — no obsolete brand`.
  ↳ Notes:

---

## 2. `imq config` — check / init / get / set

- [ ] **T2.1 [offline]** Fresh sandbox, not initialized:
  ```bash
  imq config check; echo "exit=$?"
  ```
  Expect: `exit=1` (empty config).
  ↳ Notes:
- [ ] **T2.2 [offline]** `imq config get` on empty config → a friendly "not initialized / run `imq config init`" message (not a crash).
  ↳ Notes:
- [ ] **T2.3 [offline]** Set structured values and read them back:
  ```bash
  imq config set vcs.provider github
  imq config set vcs.namespace my-org
  imq config set ci.provider circleci
  imq config set registry.provider google
  imq config set registry.project my-gcp
  imq config get
  ```
  Expect: `@imqueue CLI Config:` header, each `key = value` shown.
  ↳ Notes:
- [ ] **T2.4 [offline]** `imq config check; echo $?` now → `0` (initialized).
  ↳ Notes:
- [ ] **T2.5 [offline]** Single value + JSON forms:
  ```bash
  imq config get vcs.provider          # → "github"  (bare JSON value)
  imq config get --json                # → whole config as pretty JSON, no header
  imq config get vcs.nonexistent; echo "exit=$?"   # → "not set" on stderr, exit=1
  ```
  ↳ Notes:
- [ ] **T2.6 [offline]** Provider validation rejects bad values with the valid list:
  ```bash
  imq config set vcs.provider giturb; echo "exit=$?"
  ```
  Expect: `Invalid ... "giturb" ...` and non-zero exit; config unchanged (`imq config get vcs.provider` still `github`).
  ↳ Notes:
- [ ] **T2.7 [offline]** `packages` accepts a comma list **or** a JSON array:
  ```bash
  imq config set packages opentelemetry,pg-cache
  imq config get packages          # → ["opentelemetry","pg-cache"]
  imq config set packages '["sequelize","tag-cache"]'
  imq config get packages          # → ["sequelize","tag-cache"]
  ```
  ↳ Notes:
- [ ] **T2.8 [offline]** Config file is `0600` (may hold secrets):
  ```bash
  stat -c '%a %n' "$IMQ_CLI_HOME/.imq/config.json"
  ```
  Expect: `600 ...`.
  ↳ Notes:
- [ ] **T2.9 [offline]** Legacy mirror written for downgrade safety:
  ```bash
  cat "$IMQ_CLI_HOME/.imq/config.json"
  ```
  Expect: structured keys **and** legacy equivalents present (e.g. `gitBaseUrl`/`useGit` alongside `vcs`).
  ↳ Notes:
- [ ] **T2.10 [offline]** `imq config init` in **non-TTY** is guarded (no hang):
  ```bash
  imq config init < /dev/null; echo "exit=$?"
  ```
  Expect: a clear "requires an interactive terminal" message, non-zero exit — **not** a hang.
  ↳ Notes:
- [ ] **T2.11 [offline]** `imq config init` **interactively** (real terminal): walks VCS → CI → registry → packages → author, masks token input (`*`), ends with `@imqueue/cli successfully configured!`. Token echoes as `*`, never plaintext.
  ↳ Notes:
- [ ] **T2.12 [offline]** `imq config init` **auto-detects the git transport**: when the VCS host is enabled it prints `Detected git transport for pushes: ssh|https (...)`, and the following `Git transport for pushing new services:` prompt is **pre-selected** to the detected value. Force each branch and confirm the default flips:
  ```bash
  IMQ_SSH_DIR="$(mktemp -d)"; : > "$IMQ_SSH_DIR/id_ed25519"   # fake key → detects ssh
  IMQ_SSH_DIR="$IMQ_SSH_DIR" imq config init                  # default should be SSH
  IMQ_SSH_DIR="$(mktemp -d)" imq config init                  # empty dir → default HTTPS
  ```
  Expect: with a key present the prompt defaults to **SSH**; with an empty dir it defaults to **HTTPS**; in both cases you can override the choice.
  ↳ Notes:
- [ ] **T2.13 [offline]** `vcs.protocol` set + validation:
  ```bash
  imq config set vcs.protocol ssh   && imq config get vcs.protocol   # → "ssh"
  imq config set vcs.protocol https && imq config get vcs.protocol   # → "https"
  imq config set vcs.protocol ftp; echo "exit=$?"                    # → rejected
  ```
  Expect: `ssh`/`https` accepted; `ftp` → `Invalid git protocol "ftp". Valid: https, ssh.` and non-zero exit; config unchanged.
  ↳ Notes:

---

## 3. `imq service packages` (catalog)

- [ ] **T3.1 [offline]** `imq service packages` → lists the catalog grouped, with *exclusive* groups marked (tracing, orm) and free groups (features).
  ↳ Notes:
- [ ] **T3.2 [offline]** `imq service packages --json` (and `-j`) → valid JSON of the packages map:
  ```bash
  imq service packages --json | node -e 'JSON.parse(require("fs").readFileSync(0));console.log("valid JSON")'
  ```
  ↳ Notes:

---

## 4. `imq service create --dry-run` (the four axes, precedence, guards) — all [offline]

> `--dry-run` makes **no** network/filesystem changes; it prints the fully-resolved plan.
> Use a fresh empty config for these unless a step says otherwise:
> ```bash
> export IMQ_CLI_HOME="$(mktemp -d)"      # clean slate for section 4
> ```

- [ ] **T4.1** Minimal dry-run, empty config, non-interactive:
  ```bash
  imq service create demo "$SBX/demo" -a "Jane Dev" -e jane@dev.io --dry-run < /dev/null
  ```
  Expect: a plan with `useVcs=false`, `dockerize=false`, no VCS/registry provider; exit 0; **nothing created** (`ls "$SBX/demo"` → not present or empty).
  ↳ Notes:
- [ ] **T4.2** Missing email fails fast even in dry-run:
  ```bash
  imq service create demo "$SBX/demo" -a "Jane" --dry-run < /dev/null; echo "exit=$?"
  ```
  Expect: `Author's email is required...`, non-zero.
  ↳ Notes:
- [ ] **T4.3** Default description uses the new brand:
  ```bash
  imq service create demo "$SBX/demo" -a J -e j@d.io --dry-run < /dev/null | grep -i "description"
  ```
  Expect: `demo - @imqueue based service` (no bare `IMQ`).
  ↳ Notes:
- [ ] **T4.4** Four axes via flags resolve into the plan:
  ```bash
  imq service create demo "$SBX/demo" -a J -e j@d.io --dry-run < /dev/null \
    --use-git --vcs gitlab -u team-x --ci circleci --registry aws-ecr --account-id 12345 -D \
    --packages opentelemetry,pg-cache
  ```
  Expect: vcs=gitlab/namespace team-x, ci=circleci, registry=aws-ecr (accountId 12345), dockerize=true, packages listed; missing token shown as `<prompted at create>` (not an error).
  ↳ Notes:
- [ ] **T4.5** Precedence: CLI flag overrides global config:
  ```bash
  imq config set vcs.provider github
  imq config set ci.provider github-actions
  imq service create demo "$SBX/demo" -a J -e j@d.io --use-git -u me --vcs gitlab --dry-run < /dev/null | grep -i "vcs\|gitlab\|github"
  ```
  Expect: plan shows **gitlab** (flag wins over configured github).
  ↳ Notes:
- [ ] **T4.6** Travis only supports Docker Hub — fail fast for another registry:
  ```bash
  imq service create demo "$SBX/demo" -a J -e j@d.io --use-git -u me --vcs github \
     --ci travis --registry google -D --dry-run < /dev/null; echo "exit=$?"
  ```
  Expect: `Travis CI supports the dockerhub registry only ...`, non-zero.
  ↳ Notes:
- [ ] **T4.7** Required namespace/token on a **real** (non-dry-run) non-interactive run fail before any change:
  ```bash
  export IMQ_CLI_HOME="$(mktemp -d)"                 # empty config
  imq service create demo "$SBX/nsfail" -a J -e j@d.io --use-git --vcs github < /dev/null; echo "exit=$?"
  ls "$SBX/nsfail" 2>/dev/null && echo "LEAKED DIR (bad)" || echo "no dir created (good)"
  ```
  Expect: `GitHub namespace required ...` (or token required if you add `-u me`), non-zero, **no directory created**.
  ↳ Notes:
- [ ] **T4.8** Non-empty target directory guard + `--force`:
  ```bash
  mkdir -p "$SBX/occupied" && touch "$SBX/occupied/keep.txt"
  imq service create demo "$SBX/occupied" -a J -e j@d.io < /dev/null; echo "exit=$?"      # should refuse
  imq service create demo "$SBX/occupied" -a J -e j@d.io --force --dry-run < /dev/null    # force+dry: plan only
  ```
  Expect: first refuses with `Target directory ... is not empty ... pass --force`, non-zero, `keep.txt` untouched.
  ↳ Notes:
- [ ] **T4.9** Custom template by name/path is accepted (dry-run, no fetch needed for a bogus check):
  ```bash
  imq service create demo "$SBX/demo" -a J -e j@d.io -t some-template --dry-run < /dev/null | grep -i "template"
  ```
  Expect: plan reflects the requested template; no crash.
  ↳ Notes:
- [ ] **T4.10** Git transport in the plan (`--git-protocol`): the `vcs:` line reports the transport, defaulting to `https`:
  ```bash
  imq service create demo "$SBX/demo" -a J -e j@d.io --use-git --vcs github -u me --dry-run < /dev/null | grep -i "vcs:"
  imq service create demo "$SBX/demo" -a J -e j@d.io --use-git --vcs github -u me --git-protocol ssh --dry-run < /dev/null | grep -i "vcs:"
  imq service create demo "$SBX/demo" -a J -e j@d.io --use-git --vcs github -u me --git-protocol ftp --dry-run < /dev/null; echo "exit=$?"
  ```
  Expect: first → `vcs: github (me, private, https)`; second → `... , ssh)`; third → rejected by the flag's choices (non-zero). A per-service `.imqrc.json`/global `vcs.protocol` is used when the flag is absent.
  ↳ Notes:

---

## 5. `imq service create` — real repo creation  **[net]** (optional)

> Needs internet and a VCS token with repo-create scope. Creates a **real** repo — use a throwaway namespace.

- [ ] **T5.1 [net]** `imq config set vcs.auth.token <token>` then create a real service against a test org; verify: local scaffold created, `.imqrc.json` written at the service root **without secrets**, git repo initialised and pushed.
  ↳ Notes:
- [ ] **T5.2 [net]** Inspect the generated `.imqrc.json`:
  ```bash
  cat <service>/.imqrc.json
  ```
  Expect: resolved providers/packages present; **no** token/password/user fields.
  ↳ Notes:
- [ ] **T5.3 [net]** Honest secrets report: with cloud registry env vars unset, output states which CI secrets were/weren't provisioned (no silent success).
  ↳ Notes:
- [ ] **T5.4 [net]** HTTPS token push (default) to a **private org** repo succeeds **without** any SSH access configured for that org (this is the "Repository not found" regression). After creation, the pushed remote is clean/token-free:
  ```bash
  git -C <service> remote get-url origin     # → https://<host>/<ns>/<name>.git, NO token in it
  git -C <service> config --get-regexp '^http\.' || echo "no extraheader persisted (good)"
  ```
  Expect: repo is created, committed and pushed over HTTPS; the origin URL contains no credentials and no `http.extraHeader` is left in `.git/config`.
  ↳ Notes:
- [ ] **T5.5 [net]** SSH transport: with `--git-protocol ssh` (or `vcs.protocol ssh`) and working SSH keys, the push uses `git@<host>:<ns>/<name>.git` and no token is injected:
  ```bash
  git -C <service> remote get-url origin     # → git@<host>:<ns>/<name>.git
  ```
  ↳ Notes:
- [ ] **T5.6 [net]** Rollback prompt clarity: force a **post-create** failure (e.g. revoke push rights, or use `--git-protocol ssh` with no SSH access so the push fails after the repo exists). Interactively you get a clear prompt naming the repo, listing what **Yes** (delete/roll back) vs **No** (keep + fix manually) do, and **defaulting to No (keep)**. Non-interactively the repo is **left in place** with a notice (never deleted silently).
  ↳ Notes:

---

## 6. `imq ctl` — start / stop / restart / status

Create a local fleet (offline; services just echo the readiness marker and idle):

```bash
export FLEET="$SBX/fleet"; mkdir -p "$FLEET"
mkservice () { # $1 = name, $2 = dev-command
  mkdir -p "$FLEET/$1/src"
  cat > "$FLEET/$1/package.json" <<JSON
{ "name": "$1", "version": "1.0.0",
  "scripts": { "dev": "$2", "stop": "true" } }
JSON
  printf 'import { IMQService } from "@imqueue/rpc";\nexport class Svc extends IMQService {}\n' > "$FLEET/$1/src/index.ts"
}
mkservice alpha 'sh -c "echo reader channel connected; sleep 1000000"'
mkservice beta  'sh -c "echo reader channel connected; sleep 1000000"'
mkservice gamma 'sh -c "echo UnhandledPromiseRejection; exit 1"'   # crashes on start
ls "$FLEET"
```

- [ ] **T6.1 [offline]** Discovery + start (calm mode waits for readiness):
  ```bash
  imq ctl start -p "$FLEET" -s alpha,beta -c
  ```
  Expect: `Starting alpha, master pid is ...`, then beta; both come up (readiness marker seen). Exit 0.
  ↳ Notes:
- [ ] **T6.2 [offline]** Status shows both live:
  ```bash
  imq ctl status -p "$FLEET"
  ```
  Expect: `alpha: running (pid ...)`, `beta: running (pid ...)`.
  ↳ Notes:
- [ ] **T6.3 [offline]** Already-running is skipped (not double-started):
  ```bash
  imq ctl start -p "$FLEET" -s alpha
  ```
  Expect: `warn: alpha is already running (pid ...); ... use restart`.
  ↳ Notes:
- [ ] **T6.4 [offline]** Restart relaunches (old pid dies before new starts):
  ```bash
  imq ctl restart -p "$FLEET" -s alpha
  imq ctl status -p "$FLEET"
  ```
  Expect: alpha gets a **new** pid, still running.
  ↳ Notes:
- [ ] **T6.5 [offline]** Repeated `-s` and comma list both parse:
  ```bash
  imq ctl status -p "$FLEET" -s alpha -s beta
  ```
  Expect: both listed.
  ↳ Notes:
- [ ] **T6.6 [offline]** A crashing service is reported (start fails, not silent):
  ```bash
  imq ctl start -p "$FLEET" -s gamma -c; echo "exit=$?"
  ```
  Expect: `Failed to start gamma.` and/or a `Started 0/1 ... failed: gamma.` summary; non-zero exit.
  ↳ Notes:
- [ ] **T6.7 [offline]** Stop terminates the whole group and prints a summary:
  ```bash
  imq ctl stop -p "$FLEET" -s alpha,beta
  imq ctl status -p "$FLEET"
  ```
  Expect: `Stopping alpha (pid ...)`, `Stopping beta ...`; status then shows them **not** running / pruned.
  ↳ Notes:
- [ ] **T6.8 [offline]** No services discoverable → `start` exits non-zero with a helpful path in the message:
  ```bash
  mkdir -p "$SBX/empty"; imq ctl start -p "$SBX/empty"; echo "exit=$?"
  ```
  Expect: `No @imqueue services found under <path> ...`, non-zero.
  ↳ Notes:
- [ ] **T6.9 [offline]** `stop` from a dir with nothing discoverable falls back to all tracked pids:
  ```bash
  imq ctl start -p "$FLEET" -s alpha
  cd "$SBX/empty" && imq ctl stop            # no -s, nothing discoverable here
  imq ctl status -p "$FLEET"                 # alpha should be stopped
  cd - >/dev/null
  ```
  Expect: alpha stopped via the pidfile fallback.
  ↳ Notes:

---

## 7. `imq log`

(Ensure a couple of services are running and have produced log output first — e.g. re-run T6.1.)

- [ ] **T7.1 [offline]** `imq log --no-follow` dumps current logs and exits; multi-service lines are prefixed with a coloured `[service]` tag.
  ```bash
  imq ctl start -p "$FLEET" -s alpha,beta -c
  imq log --no-follow
  ```
  Expect: interleaved lines prefixed `[alpha]` / `[beta]`; command returns immediately.
  ↳ Notes:
- [ ] **T7.2 [offline]** Scoped to one service:
  ```bash
  imq log alpha --no-follow
  ```
  Expect: only `alpha` lines.
  ↳ Notes:
- [ ] **T7.3 [offline]** `--no-prefix` / `-P` drops the tag:
  ```bash
  imq log alpha --no-follow --no-prefix
  ```
  Expect: no `[alpha]` prefix.
  ↳ Notes:
- [ ] **T7.4 [offline]** Follow mode streams appended data, then Ctrl-C exits cleanly:
  ```bash
  imq log alpha          # follow is ON by default; watch, then press Ctrl-C
  ```
  Expect: tails live; Ctrl-C returns to the prompt without a stack trace.
  ↳ Notes:
- [ ] **T7.5 [offline]** Scoped clean removes only that log; global clean wipes all:
  ```bash
  imq log alpha --clean
  ls "$IMQ_CLI_HOME/.imq/var"        # alpha.log gone, beta.log remains
  imq log --clean
  ls "$IMQ_CLI_HOME/.imq/var"        # logs gone
  ```
  ↳ Notes:
- [ ] **T7.6 [offline]** Cleanup: `imq ctl stop -p "$FLEET"`.
  ↳ Notes:

---

## 8. `imq up`

- [ ] **T8.1 [offline]** No services found message:
  ```bash
  imq up -p "$SBX/empty"
  ```
  Expect: `No @imqueue services found to update.` (uses new brand).
  ↳ Notes:
- [ ] **T8.2 [offline]** `--skip-update` without `--commit` is rejected as a no-op:
  ```bash
  imq up -p "$FLEET" --skip-update; echo "exit=$?"
  ```
  Expect: message telling you to remove `--skip-update` or add `--commit`; non-zero.
  ↳ Notes:
- [ ] **T8.3 [offline]** Bump keyword validation:
  ```bash
  imq up -p "$FLEET" -v banana; echo "exit=$?"
  ```
  Expect: rejected — only `major|minor|patch|prerelease` accepted; non-zero.
  ↳ Notes:
- [ ] **T8.4 [net]** (optional) Full dependency update on a real service dir: runs `git pull → ncu -u → reinstall`; a failing step aborts that service **before** destructive steps and the run continues; summary + non-zero on any failure.
  ↳ Notes:

---

## 9. `imq client generate`  **[redis]** (optional)

- [ ] **T9.1 [redis]** With a real service running and Redis reachable:
  ```bash
  imq client generate <service> ./src/clients
  ```
  Expect: a typed client file is generated.
  ↳ Notes:
- [ ] **T9.2 [redis]** Service **not** running → generation fails clearly (non-zero), doesn't hang past the timeout (`-w`, default 30s).
  ↳ Notes:
- [ ] **T9.3 [redis]** `-o/--overwrite` overwrites without prompting; without it, an existing client is protected.
  ↳ Notes:

---

## 10. `imq service update-version`  **[net]** (optional)

- [ ] **T10.1 [net]** Against built, committed services: `checkout → pull → npm version → push --follow-tags`; detection is by module load (prototype chain). A failing step stops that service and the run reports it.
  ↳ Notes:

---

## 11. `imq completions`

> Uses a sandbox rc file so your real `~/.zshrc`/`~/.bashrc` is untouched.

- [ ] **T11.1 [offline]** `imq completions` (no sub) prints a completion script to stdout.
  ↳ Notes:
- [ ] **T11.2 [offline]** `on` appends to the rc and is idempotent; `off` removes it:
  ```bash
  # inspect only — verify the command reports the rc path and the "source ..." hint;
  # if you run it for real, confirm a second `on` says it already exists (no duplicate).
  imq completions on
  imq completions on      # second time → "Completion script already exists ..."
  imq completions off
  ```
  Expect: first `on` adds + prints `source ~/.zshrc` (or bashrc) hint; second `on` detects the existing block; `off` removes it. No crash if the rc file doesn't exist yet.
  ↳ Notes:

---

## 12. Config security & backward-compat

- [ ] **T12.1 [offline]** Set a token, confirm the file stays `0600` and the token is **not** printed by plain `imq config get`:
  ```bash
  imq config set vcs.auth.token ghp_exampletoken123
  stat -c '%a' "$IMQ_CLI_HOME/.imq/config.json"     # → 600
  imq config get | grep -i token || echo "token not shown in plain listing"
  ```
  ↳ Notes:
- [ ] **T12.2 [offline]** A hand-written v3 legacy config is read and derived correctly:
  ```bash
  D="$(mktemp -d)"; export IMQ_CLI_HOME="$D"; mkdir -p "$D/.imq"
  cat > "$D/.imq/config.json" <<'JSON'
  { "useGit": true, "gitBaseUrl": "git@github.com:imqueue",
    "gitHubAuthToken": "ghp_x", "gitRepoPrivate": true,
    "useDocker": true, "dockerHubNamespace": "imqueue" }
JSON
  imq service create demo "$SBX/legacy" -a J -e j@d.io --dry-run < /dev/null \
    | grep -iE "github|imqueue|dockerhub|travis"
  ```
  Expect: derives github + dockerhub (+ travis) with namespace `imqueue`; no crash.
  ↳ Notes:

---

## 13. Legacy (v1) template backward-compat — all [offline] except T13.7

> Verifies that **old (v1) templates** — those with **no `imq-template.json`** — still
> scaffold *and build* under the current CLI when addons that generate code are
> selected. Two addon generators used to assume the v2 layout and broke v1
> templates: the **OpenTelemetry** preload imported `./env-defaults.js` +
> `./config.js` (files only v2 templates ship), and **pg-prisma/validation**
> overwrote the whole `tsconfig.json` (silently dropping template settings and
> flipping decorator mode).
>
> **Setup for this section** (run from your `@imqueue/cli` checkout):
> ```bash
> export IMQ_REPO="$(pwd)"                                   # the cli checkout (run from here)
> npm run build >/dev/null                                  # compile the CLI + addon generators
> npm link >/dev/null 2>&1                                   # point `imq` at THIS build (needed by T13.5–T13.7)
> export V1TPL="${V1TPL:-$HOME/.imq/templates/sequelize}"   # any v1 template (no imq-template.json)
> command -v imq >/dev/null && echo "imq: $(readlink -f "$(command -v imq)")"
> test -f "$V1TPL/imq-template.json" && echo "NOT a v1 template (has manifest)" || echo "v1 template OK: $V1TPL"
> ```
> T13.1–T13.4 import the freshly-built generators directly, so they verify the fix
> **regardless of which `imq` is on PATH** (deterministic, no network). T13.5–T13.7
> instead exercise the real `imq service create`, so they need `imq` linked to this
> checkout (the `npm link` above) — otherwise you are testing the published CLI, not
> your changes. T13.5–T13.6 run offline (`--no-install`, no VCS); T13.7 is the
> original end-to-end repro and needs the network to install OpenTelemetry deps.

- [ ] **T13.1 [offline]** OpenTelemetry preload is **self-contained** on a v1 template (no coupling to `env-defaults`/`config`):
  ```bash
  cat > "$SBX/t131.mjs" <<'MJS'
  import * as fs from "fs";
  const { generateAddons } = await import(
      `file://${process.env.IMQ_REPO}/src/service/create-scaffold.js`);
  const d = fs.mkdtempSync("/tmp/imq-t131-");
  generateAddons(d, "// HDR", ["opentelemetry", "gcp"], false, "demo");
  const t = fs.readFileSync(d + "/src/telemetry.ts", "utf8");
  const bad = t.includes("env-defaults.js") || t.includes("./config.js");
  console.log(!bad && t.includes("process.env.IMQ_SERVICE_NAME")
      ? "PASS: v1 telemetry self-contained" : "FAIL:\n" + t);
MJS
  node "$SBX/t131.mjs"
  ```
  Expect: `PASS`. The generated `telemetry.ts` has **no** `./env-defaults.js` or `./config.js` import and derives the name from `process.env.IMQ_SERVICE_NAME || 'demo'`.
  ↳ Notes:
- [ ] **T13.2 [offline]** v2 telemetry output is **unchanged** (still uses the shared config):
  ```bash
  cat > "$SBX/t132.mjs" <<'MJS'
  import * as fs from "fs";
  const { generateAddons } = await import(
      `file://${process.env.IMQ_REPO}/src/service/create-scaffold.js`);
  const d = fs.mkdtempSync("/tmp/imq-t132-");
  generateAddons(d, "// HDR", ["opentelemetry", "gcp"], true, "demo");
  const t = fs.readFileSync(d + "/src/telemetry.ts", "utf8");
  const ok = t.includes("import './env-defaults.js';")
      && t.includes("import { config } from './config.js';")
      && t.includes("config.serviceName");
  console.log(ok ? "PASS: v2 telemetry unchanged" : "FAIL:\n" + t);
MJS
  node "$SBX/t132.mjs"
  ```
  Expect: `PASS` — the v2 (manifest) path still emits the coupled imports.
  ↳ Notes:
- [ ] **T13.3 [offline]** pg-prisma/validation **merges** the v1 `tsconfig.json` instead of clobbering it, and **warns** about the decorator switch:
  ```bash
  cat > "$SBX/t133.mjs" <<'MJS'
  import * as fs from "fs";
  const { generateAddons } = await import(
      `file://${process.env.IMQ_REPO}/src/service/create-scaffold.js`);
  const d = fs.mkdtempSync("/tmp/imq-t133-");
  fs.writeFileSync(d + "/package.json", JSON.stringify(
      { name: "demo", type: "module", scripts: { build: "tsc" } }, null, 2));
  fs.writeFileSync(d + "/tsconfig.json", JSON.stringify({ compilerOptions: {
      target: "es2024", experimentalDecorators: true, useDefineForClassFields: false,
      strict: true, noImplicitOverride: true }, exclude: ["**/debug*"] }, null, 2) + "\n");
  generateAddons(d, "// HDR", ["pg-prisma"], false, "demo");   // prints a yellow warning
  const c = JSON.parse(fs.readFileSync(d + "/tsconfig.json", "utf8"));
  const o = c.compilerOptions;
  const ok = JSON.stringify(c.exclude) === '["**/debug*"]' && o.noImplicitOverride === true
      && !("experimentalDecorators" in o) && !("useDefineForClassFields" in o)
      && (o.lib || []).includes("esnext.decorators") && o.strictPropertyInitialization === false;
  console.log(ok ? "PASS: v1 tsconfig merged (kept exclude/noImplicitOverride, native decorators)"
      : "FAIL:\n" + JSON.stringify(c, null, 2));
MJS
  node "$SBX/t133.mjs"
  ```
  Expect: a **yellow warning** ("...require native (TC39) decorators - tsconfig.json was switched over...") **and** `PASS`. Template keys (`exclude`, `noImplicitOverride`) survive; classic-decorator switches are removed; `esnext.decorators` + relaxations are added.
  ↳ Notes:
- [ ] **T13.4 [offline]** On a v2 template pg-prisma still writes the **canonical** native-decorator tsconfig verbatim (no merge, no `exclude` leaking in):
  ```bash
  cat > "$SBX/t134.mjs" <<'MJS'
  import * as fs from "fs";
  const { generateAddons } = await import(
      `file://${process.env.IMQ_REPO}/src/service/create-scaffold.js`);
  const d = fs.mkdtempSync("/tmp/imq-t134-");
  fs.writeFileSync(d + "/package.json", JSON.stringify(
      { name: "demo", type: "module", scripts: { build: "tsc" } }, null, 2));
  fs.writeFileSync(d + "/tsconfig.json", JSON.stringify(
      { compilerOptions: { experimentalDecorators: true }, exclude: ["**/debug*"] }));
  generateAddons(d, "// HDR", ["pg-prisma"], true, "demo");   // isV2 = true
  const c = JSON.parse(fs.readFileSync(d + "/tsconfig.json", "utf8"));
  const ok = !("exclude" in c) && !("experimentalDecorators" in c.compilerOptions)
      && (c.compilerOptions.lib || []).includes("esnext.decorators");
  console.log(ok ? "PASS: v2 tsconfig canonical (no template residue)"
      : "FAIL:\n" + JSON.stringify(c, null, 2));
MJS
  node "$SBX/t134.mjs"
  ```
  Expect: `PASS`, **no** warning (nothing was merged).
  ↳ Notes:
- [ ] **T13.5 [offline]** Real `imq service create` from a v1 template (OpenTelemetry), offline, produces a self-contained `telemetry.ts`:
  ```bash
  rm -rf "$SBX/v1otel"
  imq service create v1otel "$SBX/v1otel" -a J -e j@d.io -t "$V1TPL" \
    --packages opentelemetry,gcp --no-install < /dev/null; echo "exit=$?"
  grep -nE "env-defaults\.js|\./config\.js" "$SBX/v1otel/src/telemetry.ts" \
    && echo "FAIL: coupled import present" || echo "PASS: no coupled imports"
  grep -n "IMQ_SERVICE_NAME" "$SBX/v1otel/src/telemetry.ts"
  ```
  Expect: exit 0; `PASS: no coupled imports`; the `IMQ_SERVICE_NAME` line is present with `v1otel` baked in.
  ↳ Notes:
- [ ] **T13.6 [offline]** Real `imq service create` from a v1 template (pg-prisma), offline, warns and merges the tsconfig (template settings preserved):
  ```bash
  rm -rf "$SBX/v1prisma"
  imq service create v1prisma "$SBX/v1prisma" -a J -e j@d.io -t "$V1TPL" \
    --packages pg-prisma --no-install < /dev/null 2>&1 | tee "$SBX/v1prisma.log" | grep -i "native (TC39) decorators" \
    && echo "PASS: decorator warning shown" || echo "check log: $SBX/v1prisma.log"
  node -e 'const c=require("'"$SBX"'/v1prisma/tsconfig.json");console.log("experimentalDecorators present?",("experimentalDecorators" in (c.compilerOptions||{})),"| exclude kept?",JSON.stringify(c.exclude))'
  ```
  Expect: the decorator warning is printed during creation; the resulting `tsconfig.json` has **no** `experimentalDecorators` but **keeps** the template's own top-level keys (e.g. `exclude`).
  ↳ Notes:
- [ ] **T13.7 [net]** End-to-end repro of the original bug — create from a v1 template with OpenTelemetry and let it **install + build**:
  ```bash
  rm -rf "$SBX/v1build"
  imq service create v1build "$SBX/v1build" -a J -e j@d.io -t "$V1TPL" \
    --packages opentelemetry,gcp < /dev/null; echo "exit=$?"
  test -f "$SBX/v1build/src/telemetry.js" && echo "PASS: telemetry compiled" || echo "FAIL: build did not emit telemetry.js"
  ```
  Expect: `npm install` (which runs the template's `prepublish`/`build`) exits **0** — no `TS2882`/`TS2307` on `./env-defaults.js` or `./config.js` — and `telemetry.js` is emitted. (This is the exact scenario from the bug report.)
  ↳ Notes:

---

## 14. Teardown

```bash
imq ctl stop -p "$FLEET" 2>/dev/null || true
rm -rf "$IMQ_CLI_HOME" "$SBX"
unset IMQ_CLI_HOME IMQ_NO_UPDATE_CHECK SBX FLEET V1TPL IMQ_REPO
```

- [ ] **T14.1** Sandbox dirs removed; real `~/.imq` never touched (`ls ~/.imq` unchanged from before testing).
  ↳ Notes:

---

## Free-form problem log

> Anything that didn't fit a checkbox — surprising UX, confusing wording, wrong exit codes, colours, etc.

1.
2.
3.
