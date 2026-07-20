#!/bin/bash
# Runs the test harness inside a clean container.
#
# Two modes:
#   1. Full image (needs network for `npm ci` + template fetch + addon installs):
#        docker build -f test/docker/Dockerfile -t imqueue-cli-test .
#        docker run --rm imqueue-cli-test
#   2. Mounted (this script): reuse the host's node_modules/dist and a local
#      templates checkout - works without container network.
set -eu
CLI_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
TEMPLATES_DIR="${TEMPLATES_DIR:-$(cd "$CLI_DIR/../templates" && pwd)}"

docker run --rm \
    -v "$CLI_DIR":/cli \
    -v "$TEMPLATES_DIR":/templates:ro \
    -e IMQ_TEST_TEMPLATE=/templates/default \
    -w /cli \
    node:24 \
    bash test/docker/harness.sh
