#!/bin/bash
# In-container test harness for @imqueue/cli.
#
# Network-aware: with network it fetches templates over HTTPS and does a full
# create -> install -> build -> test matrix; offline it uses a local template
# (IMQ_TEST_TEMPLATE) and verifies scaffolding only. Always runs the unit
# suite and the offline command checks.
set -u
cd /cli
FAIL=0
mark() { if [ "$1" -eq 0 ]; then echo "  PASS: $2"; else echo "  FAIL: $2"; FAIL=1; fi; }

export IMQ_NO_UPDATE_CHECK=1
export IMQ_CLI_HOME=/tmp/imqhome
rm -rf "$IMQ_CLI_HOME"; mkdir -p "$IMQ_CLI_HOME"

# build if not already built (mounted node_modules + dist skip this)
[ -f index.js ] || npm run build >/tmp/build.log 2>&1

ONLINE=0
timeout 6 node -e "fetch('https://registry.npmjs.org').then(()=>process.exit(0)).catch(()=>process.exit(1))" >/dev/null 2>&1 && ONLINE=1
echo "network: $([ $ONLINE -eq 1 ] && echo online || echo offline)"
TEMPLATE="${IMQ_TEST_TEMPLATE:-}"
TPL_ARG=""; [ -n "$TEMPLATE" ] && TPL_ARG="--template $TEMPLATE"

echo "== 1. unit test suite =="
npm test >/tmp/unit.log 2>&1; mark $? "unit tests ($(grep -oE 'pass [0-9]+' /tmp/unit.log | tail -1))"

echo "== 2. version / help / dry-run =="
node index.js --version >/dev/null 2>&1; mark $? "imq --version"
node index.js service create --help >/dev/null 2>&1; mark $? "service create --help"
node index.js service create demo /tmp/dry $TPL_ARG --dry-run -a A -e a@b.io -l MIT </dev/null >/dev/null 2>&1
mark $? "service create --dry-run"

echo "== 3. real create ($([ $ONLINE -eq 1 ] && echo 'fetch+install+build+test' || echo 'scaffold only')) =="
run_case() {
  local name="$1"; shift
  local dir="/tmp/svc-$name"
  node index.js service create "$name" "$dir" $TPL_ARG --no-install -y \
    -a Tester -e tester@example.io -l MIT "$@" </dev/null >"/tmp/$name.log" 2>&1
  if [ ! -d "$dir" ]; then echo "  FAIL: create $name"; tail -3 "/tmp/$name.log" | sed 's/^/      /'; FAIL=1; return; fi
  if [ $ONLINE -eq 1 ]; then
    ( cd "$dir" && npm install --no-audit --no-fund >/tmp/$name.i.log 2>&1 \
        && npm run build >/tmp/$name.b.log 2>&1 && npm test >/tmp/$name.t.log 2>&1 )
    mark $? "create+install+build+test: $name $*"
  else
    # scaffold check: a service class file was generated
    ls "$dir"/src/*.ts >/dev/null 2>&1 && grep -q "IMQService" "$dir"/src/*.ts
    mark $? "scaffold: $name $* (service file generated)"
  fi
}
run_case plain --ci github-actions
run_case circle --ci circleci
run_case travis --ci travis
[ $ONLINE -eq 1 ] && run_case otel --packages opentelemetry,pg-cache

echo "== 4. config + completions =="
node index.js config check; [ $? -eq 1 ]; mark $? "config check exits 1 when empty"
node index.js config set ci.provider circleci >/dev/null 2>&1
[ "$(node index.js config get ci.provider 2>/dev/null)" = '"circleci"' ]; mark $? "config set/get dot-path"
node index.js config check; mark $? "config check exits 0 when set"
SHELL=/bin/bash node index.js completions on >/dev/null 2>&1
grep -q "###-begin" "$IMQ_CLI_HOME/.bashrc" 2>/dev/null; mark $? "completions on writes block"

echo "======================================"
if [ "$FAIL" -eq 0 ]; then echo "ALL CHECKS PASSED"; else echo "SOME CHECKS FAILED"; fi
exit $FAIL
