# Documentation Map

Use the smallest relevant context set. Start with `AGENTS.md`; load one task-specific document, then follow cross-links only if the change crosses that boundary.

| Work item | Minimum context |
| --- | --- |
| Startup/runtime function flow | [architecture/runtime-flow.md](architecture/runtime-flow.md) |
| Config, JSON stores, or record shape | [architecture/data-models.md](architecture/data-models.md) |
| Plugin implementation or registration | [architecture/components.md](architecture/components.md), then the [Cursor plugin skill](../.cursor/skills/plugin-development/SKILL.md) or [GitHub plugin skill](../.github/skills/plugin-development/SKILL.md) |
| ACLs, user roles/groups, or authorization | [architecture/authorization.md](architecture/authorization.md) |
| Secret-store backend or user secret refs | [architecture/data-models.md](architecture/data-models.md), then the [Cursor secret-store skill](../.cursor/skills/configure-secret-store/SKILL.md) or [GitHub secret-store skill](../.github/skills/configure-secret-store/SKILL.md) |
| Dashboard/API | [architecture/runtime-flow.md](architecture/runtime-flow.md#dashboard-flow) |
| Railway deployment/runtime failure | [platforms/railway.md](platforms/railway.md) |
| Test changes | the matching domain reference and `.github/instructions/testing.instructions.md` |

## Toolkit Entry Points

- **Cursor:** `.cursor/rules/` contains narrow rules with `globs`; the always-on rule only routes to this map and `AGENTS.md`. On-demand workflows live in `.cursor/skills/`.
- **GitHub Copilot:** `.github/copilot-instructions.md` is the short global router. Files in `.github/instructions/` apply only to matching paths; `.github/skills/` workflows are on demand.
- **Railway:** use [platform guidance](platforms/railway.md) and the matching [Cursor skill](../.cursor/skills/railway-operations/SKILL.md) or [GitHub skill](../.github/skills/railway-operations/SKILL.md). Deploy start command is defined in [`railway.toml`](../railway.toml) (`npm start` → web dashboard).

## Documentation Ownership

Keep task procedures in skills, path-specific constraints in tool instruction/rule files, architecture facts in `docs/architecture/`, and service operation guidance in `docs/platforms/`. Avoid copying long explanations into always-loaded agent instructions.