---
name: plugin-development
description: "Develop or modify an auto-discovered MCP Uni Hubs plugin and verify its startup contract."
---

# Plugin Development

Use this workflow when adding or changing a module under `plugins/` or a plugin implementation under `src/`.

1. Read `AGENTS.md`, then only [runtime flow](../../../docs/architecture/runtime-flow.md) and [component contracts](../../../docs/architecture/components.md) relevant to the change.
2. Keep `plugins/<name>.js` as a small factory/registration wrapper. The plugin loader accepts a default factory or a module exposing `register(appContext)`.
3. Receive shared services through `appContext`; do not create competing datastore, logger, or config singletons.
4. Keep provider calls behind the plugin's domain interface and report honestly whether a provider is implemented or simulated. For access rules, also load [authorization](../../../docs/architecture/authorization.md).
5. Add or extend focused tests in `tests/hub-engine.test.js` for registration, inputs, and observable results.
6. Run `npm test` and review `git diff --check` before concluding.

Do not add real credentials to plugin defaults or examples. Use environment placeholders in config and synthetic values in tests.