---
name: plugin-development
description: "Add or change an auto-discovered MCP Uni Hubs plugin."
---

# Plugin Development

1. Read `AGENTS.md`, then only the relevant portions of `docs/architecture/runtime-flow.md` and `docs/architecture/components.md`.
2. Follow `.github/skills/plugin-development/SKILL.md` for the shared plugin contract and verification steps.
3. Keep the plugin entry file a factory/registration wrapper; receive app services through `appContext`.
4. If the operation is protected, read `docs/architecture/authorization.md` and wire an explicit `canAccess()` check. Loader registration is not authorization.
5. Add focused tests and run `npm test`.