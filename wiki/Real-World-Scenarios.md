# Real-World Scenarios

End-to-end walkthroughs that combine the commands. Each assumes you have run
`imq config init` once (adjust to taste).

## 1. New service on GitHub + GitHub Actions + Docker Hub

The default stack. One command, non-interactive:

```bash
imq service create billing ./billing -y \
  -a "Acme Inc" -e dev@acme.io -l MIT \
  --vcs github -u acme --ci github-actions \
  --registry dockerhub -N acme -D
```

This scaffolds the service, creates the `acme/billing` repo, provisions GitHub
Actions sealed secrets, commits, pushes and tags `1.0.0-0`, and enables
dockerized CI builds pushing to `acme/billing` on Docker Hub. The push goes
over HTTPS authenticated with your token by default, so it works even for a
private org repo your SSH key can't reach; add `--git-protocol ssh` to push
with your own keys instead.

## 2. GitLab + CircleCI + Google Artifact Registry

```bash
imq service create orders ./orders -y \
  -a "Acme Inc" -e dev@acme.io -l MIT \
  --vcs gitlab -u acme-group --ci circleci \
  --registry google --project acme-prod --region europe-west1 \
  --packages opentelemetry,pg-cache
```

Preview it first without touching anything:

```bash
imq service create orders ./orders --dry-run \
  --vcs gitlab -u acme-group --ci circleci \
  --registry google --project acme-prod --region europe-west1 \
  --packages opentelemetry,pg-cache -a Acme -e dev@acme.io
```

## 3. GitHub Enterprise (self-hosted)

Point the GitHub provider at your enterprise API; everything else is the same:

```bash
export IMQ_GITHUB_API_URL=https://github.acme-corp.com/api/v3
imq service create payments ./payments -y \
  --vcs github -u platform --ci github-actions \
  -T "$GHE_TOKEN" -a "Acme Corp" -e platform@acme-corp.com
```

Analogously use `IMQ_GITLAB_API_URL` for self-managed GitLab, or
`IMQ_BITBUCKET_API_URL` for a Bitbucket Cloud 2.0-compatible endpoint. See
[Providers](Providers#enterprise--self-hosted).

## 4. A local fleet of services

You have a folder `~/work/services` with several service repos side by side.

```bash
cd ~/work/services

# bring them all up, waiting for each to be ready, pulling latest first
imq ctl start -u -c

# watch combined, colour-prefixed logs
imq log

# generate a client for one of them while it runs (in another terminal)
imq client generate billing ./billing/src/clients -o

# restart a couple after code changes
imq ctl restart -s billing,orders

# stop everything when done
imq ctl stop
```

## 5. Fleet-wide dependency maintenance

```bash
cd ~/work/services

# update deps everywhere (rewrites package.json + reinstalls; no git commit)
imq up

# then patch-bump, commit and push each service that actually changed
imq up -c -v patch
```

`imq up` installs `npm-check-updates` on first use if it is missing, and only
commits/pushes services whose working tree changed. Make sure trees are clean
before an `-c` run.

## 6. Coordinated release across services

To cut a release across many services on a branch (triggering their CI):

```bash
imq service update-version ~/work/services main -n minor
```

For each service it does `git checkout main → git pull → npm version minor →
git push --follow-tags`, stopping a given service on the first failing step.
Compare with `imq up` in [Clients & Versioning](Clients-and-Versioning#update-version-vs-up).

## 7. Standardising new services for your org

Encode your conventions once in a [custom template](Custom-Templates) and set
org defaults:

```bash
export IMQ_TEMPLATES_REPO=git@github.com:acme/imq-templates.git
imq config set templatesRef main
imq config set vcs.provider github
imq config set vcs.namespace acme
imq config set ci.provider github-actions
imq config set registry.provider dockerhub
imq config set packages opentelemetry,pg-cache
```

Now every new service is one command and comes out fully wired and on-brand:

```bash
imq service create <name> ./<name> -y -a "Acme Inc" -e dev@acme.io
```
