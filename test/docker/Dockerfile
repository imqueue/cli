# Reproducible test environment for @imqueue/cli.
#
# The full node image bundles git (needed to fetch templates and to commit),
# and has NO ssh key configured - which also proves the CLI can fetch its
# templates over public HTTPS (the default TPL_REPO).
#
#   docker build -f test/docker/Dockerfile -t imqueue-cli-test .
#   docker run --rm imqueue-cli-test
#
# (Needs network at build/run time for `npm ci`, template fetch and addon
# installs. For an offline, host-mounted run see test/docker/run.sh.)
FROM node:24

WORKDIR /cli
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

ENTRYPOINT ["bash", "test/docker/harness.sh"]
