# Components and Function Contracts

This reference maps the principal modules to their public operations. For call order use [Runtime Flow](runtime-flow.md); for record shapes use [Data Models](data-models.md).

## Hub Registry — `src/hub-engine.js`

- `McpHub` normalizes a hub's `id`, `name`, `transport`, `metadata`, `status`, and construction timestamp; `toJSON()` returns those public fields.
- `HubRegistry.register(hub)` accepts only `McpHub`, replacing an existing entry with the same ID.
- `get(id)` returns the hub or `null`; `list()` returns an array; `remove(id)` returns the removed hub or `null`.
- `status()` counts `healthy`, `degraded`, and `offline`; `buildHubSummary()` omits metadata/timestamps for the compact summary.
- `createDefaultRegistry()` returns three static sample hubs. This is not a discovery client.

## Local Data and Plugin Loading — `src/local-data-store.js`

- `LocalDataStore` is the persistent JSON record implementation. Its operations and failure behavior are documented in [Data Models](data-models.md).
- `PluginLoader({ pluginDirectories, appContext }).loadAll()` scans direct children for `.js` files, dynamically imports them, and invokes a default function or `.register(appContext)`. The filename becomes the plugin name.
- Loading does not inspect ACLs, authenticate users, or wrap plugin methods. It is registration/instantiation only.

## Connection Abstraction — `src/data-connection-manager.js`

- `connect(areaName, config)` stores an area config and accepts only `file` or `sql`.
- `read`, `write`, and `query` dispatch on the stored type. File mode reads/writes one JSON object. SQL mode currently uses in-memory rows and recognizes a small set of `SELECT` patterns; it is not connected to a SQL server.
- `getConnection(areaName)` throws when the area has not been configured.

## Access Control — `src/access-control.js`

`AccessControlPlugin` provides user/group/organization reads, `listGroupsForUser()`, `listAclEntries()`, and `canAccess(userId, resourceId, action, resourceType = 'plugin')`. The exact evaluation sequence, data fields, examples, and enforcement limitation are in [Authorization](authorization.md).

## Secrets — `src/secrets-manager.js`

- `loadEnvironment(userId, environmentName)` reads `<userId>-<environmentName>` and normalizes `secretRefs`.
- `resolveUserEnvironment()` resolves each reference through configured store/backend and returns `{ [ref.key]: value }`.
- `listConfiguredStores()` returns store IDs; it does not test network reachability.
- Secretario is the only implemented remote HTTP backend. It sends GET to Vault KV v2 and reads `data.data`; the other backend functions are placeholder values.

## VM Orchestrator — `plugins/vm-orchestrator.js`

- `listVirtualMachines()` reads all `virtual-machines` records; `getVmDefinition(idOrName)` returns one or throws.
- `createVm`, `startVm`, `stopVm`, and `deleteVm` call `performAction()`, normalize a provider, build a request, call a local protocol handler, and persist the resulting state.
- Current provider handlers construct simulated results; no cloud SDK or remote API call is made. Do not describe these operations as provisioning real VMs.

## Logger — `src/logger.js`

`AppLogger` accepts `DEBUG`, `INFO`, `WARN`, `ERROR`, or `CRITICAL`; `write()` filters below-level events and appends JSON lines to a daily service/instance file. `createDefaultLogger()` reads `LOG_LEVEL`, `LOG_DIR`, `INSTANCE_ID`, and `SERVICE_NAME` before explicit config overrides.

## Web Dashboard — `src/web-server.js`, `src/app-runtime.js`, `public/`

`createDashboardServer(runtime)` accepts only GET, serves three static paths and `GET /api/dashboard`, and emits basic content/security headers. `buildDashboardData()` selects safe user and store fields; see [Runtime Flow](runtime-flow.md). There is no login, session, or ACL check in the web request handler, so it must not be treated as an authenticated administrative console when exposed publicly.