# Architecture Overview

## Runtime Flow

`src/index.js` is the CLI entry point. It calls `createApplicationRuntime()` in `src/app-runtime.js`, prints the returned summary, and exits. The runtime:

1. Creates the hub registry, local datastore, and logger.
2. Loads `config/app.env.json` (falling back to `config/app.config.json`).
3. Expands `${NAME}` placeholders using process environment variables.
4. Bootstraps configured stores and identity records into `data/`, redacting credential-shaped store fields before persistence.
5. Scans `plugins/` and instantiates plugin modules with a shared application context.

The dashboard entry point is `src/web-server.js`. It uses the same runtime and serves static files from `public/` plus `GET /api/dashboard`. The dashboard API intentionally returns a sanitized view, never secret-store tokens or user password fields.

## Main Components

| Area | Entry points | Responsibility |
| --- | --- | --- |
| Hubs | `src/hub-engine.js` | Hub model, registry, status summary |
| Data | `src/data-connection-manager.js`, `src/local-data-store.js` | SQL/file abstraction, local JSON records, plugin discovery |
| Plugins | `plugins/*.js` | Small registration wrappers loaded from disk at startup |
| Access | `src/access-control.js` | User/group/org lookup and ACL action decisions |
| Secrets | `src/secrets-manager.js` | User environment resolution and secret-provider dispatch |
| Runtime/config | `src/app-runtime.js`, `src/config-loader.js` | Shared initialization, env expansion, bootstrap, dashboard-safe data |
| Web | `src/web-server.js`, `public/` | Read-only application overview UI and API |
| Logging | `src/logger.js` | Configurable levels and per-day/per-instance files |

## Configuration and Data

The main config is `config/app.env.json`. It contains store definitions, organizations, groups, users, per-user environments, and ACL entries. Values such as the Secretario token use environment placeholders, for example `${SECRETARIO_TOKEN}`; deploy-time secret values must be supplied through the service environment.

Bootstrap stores resources in one JSON file per record under `data/<area>/<id>.json`. `data/` is application state and may contain user-owned edits. Test fixtures and runtime artifacts belong under ignored `tmp/` and `logs/` paths.

For secrets, a user's environment record contains `secretRefs` with `key`, `store`, and `path`. The store name must match a key under `stores` in the runtime config. Secretario uses Vault KV v2 path conventions configured by `kv.mount` and `kv.dataPath`.

## Integration Boundaries

- Secretario is the implemented HTTP secret backend. Other named providers in `src/secrets-manager.js` are placeholders and must not be presented as production integrations.
- The VM orchestrator models provider dispatch and results; it does not yet execute real cloud API requests.
- The SQL branch in `UniversalConnectionManager` is an in-memory prototype, not a database driver.
- Secret-store dashboard status is `Configured`; no remote health check currently runs at startup or in the dashboard.
- ACL checks are exposed by `AccessControlPlugin.canAccess()`. When adding a protected operation, ensure the operation actually invokes authorization; defining ACL data alone does not enforce it.

## Verification

Run the complete suite with `npm test`. Tests use the Node.js built-in test runner and temporary records under `tmp/`. The web API's credential redaction and core bootstrap behavior have regression coverage in `tests/hub-engine.test.js`.