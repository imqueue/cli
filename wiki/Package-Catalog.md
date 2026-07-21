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

| Group | Exclusive? | Members |
|---|---|---|
| **Tracing / APM** | yes | `opentelemetry`, `dd-trace` |
| **ORM / database** | yes | `sequelize`, `prisma` |
| **Service features** | no | `pg-cache`, `pg-pubsub`, `tag-cache`, `job`, `net`, `http-protect`, `graphql-dependency`, `type-graphql-dependency` |

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

## Extending the catalog

Because the catalog is data, you can publish new addons by editing
`catalog.json` in your own fork of the templates repo (point the CLI at it via
`IMQ_TEMPLATES_REPO` and `templatesRef`). Each entry declares its group,
dependencies, the snippets to inject at the addon token points, any extra
files, and the environment variables to advertise. See
[Custom Templates](Custom-Templates) and [Extensibility](Extensibility).
