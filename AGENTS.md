# Agent Guide

MCP Uni Hubs is a dependency-light Node.js ES-module application. This file is the cross-tool entry point; load only the task-specific reference you need.

Start at [docs/README.md](docs/README.md), select one reference for the current task, and avoid reading the entire docs tree unless the change crosses multiple component boundaries.

## Route By Task

| Task | Read next |
| --- | --- |
| Understand a request/startup path | [docs/architecture/runtime-flow.md](docs/architecture/runtime-flow.md) |
| Change data, config, or datastore records | [docs/architecture/data-models.md](docs/architecture/data-models.md) |
| Change ACL behavior or protected actions | [docs/architecture/authorization.md](docs/architecture/authorization.md) |
| Change a core service/plugin boundary | [docs/architecture/components.md](docs/architecture/components.md) |
| Configure or extend secrets | [.github/skills/configure-secret-store/SKILL.md](.github/skills/configure-secret-store/SKILL.md) |
| Add/change a plugin | [.github/skills/plugin-development/SKILL.md](.github/skills/plugin-development/SKILL.md) |
| Deploy or debug on Railway | [docs/platforms/railway.md](docs/platforms/railway.md) |
| Find the right doc/tool instructions | [docs/README.md](docs/README.md) |

## Shared Rules

- Use `npm test` after behavior changes. The project uses Node.js built-ins and ES modules; avoid dependencies without a concrete need.
- `SECRETARIO_TOKEN` is supplied at runtime. Never commit or persist usable credentials.
- `tmp/` and `logs/` are generated. Do not include them in changes.
- A configured secret store is not necessarily reachable. SQL storage and most VM providers are prototypes; the Railway VM provider uses live GraphQL when `RAILWAY_TOKEN` / `RAILWAY_API_TOKEN` is set. See the component and Railway platform references.
- Preserve existing user data and unrelated working-tree changes.

## Tool Adapters

- Cursor: load the matching `.cursor/rules/*.mdc` file; rules are intentionally scoped.
- GitHub Copilot: use `.github/copilot-instructions.md`, matching `.github/instructions/*.instructions.md`, and task-specific skills.
- Railway: use the Railway operations guide. Deploy start command is in `railway.toml` (`npm start` → web dashboard).