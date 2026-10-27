# Runtime and Function Flows

## Shared Bootstrap

Both application entry points use `createApplicationRuntime()` from `src/app-runtime.js`. The runtime is the composition root; feature modules should receive dependencies through `appContext` instead of constructing a second application singleton.

1. `createDefaultRegistry()` builds the in-memory hub registry and initial hub records.
2. `LocalDataStore(resolve(rootDir, 'data'))` establishes the local JSON store; `createDefaultLogger()` resolves the log directory and environment overrides.
3. `ConfigLoader(configPath).load()` parses `config/app.env.json`. Only a missing primary file triggers fallback to `config/app.config.json`; malformed JSON is an error.
4. The loader recursively expands `${UPPER_CASE_NAME}` using `process.env`. Missing variables become empty strings. The deployed service must provide required variables such as `SECRETARIO_TOKEN`.
5. `bootstrapEnvironmentData(datastore, startupConfig)` writes stores and configured organizations, groups, users, environments, and ACLs. Store credential-shaped fields are removed before writing. Bootstrap overwrites matching keys but does not delete records removed from config.
6. `PluginLoader.loadAll()` scans `plugins/` for top-level `.js` files, imports each module, and calls either its default function or its `register(appContext)` export.
7. Runtime code locates `vm-orchestrator`, `access-control`, and `secrets-manager` by loaded filename, collects VM definitions and configured store IDs, and returns `{ rootDir, configPath, startupConfig, datastore, logger, plugins, summary }`.

## CLI Flow

`src/index.js` checks `isMainModule()`. When run as `npm run cli`, it calls `createApplicationRuntime()` and prints `runtime.summary` as JSON. Importing the module from a test does not start the app. It re-exports core types and the runtime factory. `npm start` runs the web dashboard (`src/web-server.js`), not this CLI summary.

## Dashboard Flow

`src/web-server.js` calls the same runtime factory, then listens on `HOST` and `PORT` (`0.0.0.0:3000` defaults).

| Request | Behavior |
| --- | --- |
| `GET /` | Serves `public/index.html` |
| `GET /app.js` | Serves dashboard browser code |
| `GET /styles.css` | Serves dashboard styles |
| `GET /api/dashboard` | Calls `buildDashboardData(runtime)` and returns a sanitized snapshot |
| Other paths | 404 |
| Non-GET methods | 405 |

`buildDashboardData()` reads user records from the datastore but only selects identity fields (`id`, `username`, `email`, `organizationId`, `groupIds`, `roles`). Store metadata is selected from runtime config without token/header fields. `status: "Configured"` is metadata, not a health probe. The API has no authentication middleware in the current implementation.

## Secrets Resolution Flow

1. Caller invokes `SecretsManagerPlugin.resolveUserEnvironment(userId, environmentName)`.
2. `loadEnvironment()` reads `user-environments/<userId>-<environmentName>.json` and normalizes `secretRefs`.
3. Each reference selects `config.stores[ref.store]`; backend type is normalized from `store.type` or the store ID.
4. Backend receives the reference path/key and configured endpoint, headers, KV settings, and runtime token.
5. Secretario sends HTTP GET to the configured Vault KV v2 data URL with `X-Vault-Token`; the requested key is read from `payload.data.data` (with a fallback for other response shapes).
6. The resolved environment is a map from secret key to value. Never log or serialize that map into the dashboard or normal operational output.

The provider functions other than Secretario are placeholders, not remote connectors.