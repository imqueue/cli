# Package Catalog

`imq service create --packages <list>` adds secondary @imqueue libraries to a
new service and wires them in automatically. The catalog is **data**
(`catalog.json`, shipped with the CLI and mirrored in the templates repo), so
new addons can appear without a CLI release.

```bash
imq service create billing ./billing --packages opentelemetry,pg-cache,tag-cache
imq service create billing ./billing --no-packages     # explicitly none
```

You can also set a default list globally so every new service gets them:

```bash
imq config set packages opentelemetry,pg-cache
```

To see every available package id (grouped, with a one-line description):

```bash
imq service packages          # human-readable
imq service packages --json   # machine-readable
```

## Groups

Packages belong to groups. **Exclusive** groups accept at most one member;
selecting two members of the same exclusive group is rejected with an error.
At most one, not exactly one — selecting none is a normal answer, and for a
service that talks to no database it is the right one.

| Group | Exclusive? | Members |
|---|---|---|
| **Tracing / APM** | yes | `opentelemetry`, `dd-trace` |
| **ORM / database** | yes | `pg-prisma`, `sequelize` |
| **Service features** | no | `pg-cache`, `pg-pubsub`, `tag-cache`, `job`, `net`, `http-protect`, `graphql-dependency`, `type-graphql-dependency` |

These are catalog **ids** — what `--packages` takes and what a saved config
holds — not npm package names, and two of them no longer match. `dd-trace`
installs `@imqueue/datadog` and `sequelize` installs `@imqueue/pg-sequelize`,
both renamed while the ids stayed put so that existing configs and `.imqrc.json`
files keep working.

## What each addon does when selected

For every selected package the scaffolder:

1. **Merges its dependencies** (and devDependencies) into the service
   `package.json`, preserving the versions declared by the template/catalog.
2. **Injects wiring code** at the template's addon token points:
   - `%ADDON_PRELOAD` — imports / setup that must run early (e.g. tracing
     bootstrap before other imports).
   - `%ADDON_CONFIG` — configuration wiring inside the service setup.
3. May add **extra files** the addon needs.
4. **Prints required environment variables** after creation (e.g. tracing
   endpoints, database URLs), so you know exactly what to configure.

## Choosing addons interactively

Run `imq config init` or `imq service create` on a TTY without `--packages`
and you will get a multi-select for the feature group and single-selects for
the exclusive groups. Non-interactive runs use your config/flags and never
prompt.

Each exclusive list marks one member **(recommended)**, and `(none)` is always
the first choice. The recommendation is `pg-prisma` for the ORM and
`opentelemetry` for tracing — unless the fleet says otherwise.

### Following the fleet

`imq service create` looks at the directory the new service is being created
into, and treats every sibling directory whose `package.json` depends on
`@imqueue/rpc` as part of your fleet. If those services already agree on an
ORM or a tracing backend, that member becomes both the preselected and the
recommended one, with a line above the list saying why:

```
? Select ORM / database:
  Only if the service uses a database — none is normal.
  Preselected sequelize to match 2 services in this fleet. Moving the fleet to
  pg-prisma is worth considering — as its own piece of work, not as part of this.
  (none)
  Prisma ORM + @imqueue/pg-prisma toolkit
❯ Sequelize ORM + @imqueue/pg-sequelize toolkit (recommended)
```

A new service in an established fleet belongs on the fleet's stack: matching
what is already there beats taking the default.

A fleet that disagrees with itself gets no proposal: with a strict majority the
majority wins, and on a tie nothing is preselected and only the fallback is
marked. The same analysis drives the VCS host and CI provider prompts — see
[Creating Services](Creating-Services).

Scanning is cheap but not free, so the result is cached in
`~/.imq/var/fleet.json`, keyed by directory (`IMQ_CLI_HOME` relocates it with
the rest of the CLI's files). The cache is invalidated when the set of sibling
directories changes. Choosing against the analysis is taken as intent: your
choice is recorded as an override for that directory and proposed next time,
until a later scan agrees with it on its own.

## Extending the catalog

Because the catalog is data, you can publish new addons by editing
`catalog.json` in your own fork of the templates repo (point the CLI at it via
`IMQ_TEMPLATES_REPO` and `templatesRef`). Each entry declares its group,
dependencies, the snippets to inject at the addon token points, any extra
files, and the environment variables to advertise. See
[Custom Templates](Custom-Templates) and [Extensibility](Extensibility).
