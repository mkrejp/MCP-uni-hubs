# Data Models and Persistence

## Configuration Root

`config/app.env.json` is the shared source for stores and identity bootstrap. Top-level collections are maps or arrays as shown below; current bootstrap accepts arrays for organizations, groups, users, `userEnvironments` (also `user-environments`), and ACLs.

```json
{
  "stores": {
    "secretario": {
      "name": "secretario",
      "type": "Secretario",
      "address": "http://secretario.internal:8200",
      "token": "${SECRETARIO_TOKEN}",
      "headers": { "X-Vault-Token": "${SECRETARIO_TOKEN}" },
      "kv": { "engine": "kv-v2", "mount": "secret", "dataPath": "/v1/secret/data/<path>" }
    }
  },
  "organizations": [],
  "groups": [],
  "users": [],
  "userEnvironments": [],
  "acls": []
}
```

`ConfigLoader` expands environment placeholders recursively. Do not store literal credentials in the JSON file. The bootstrap strips fields whose names resemble token/password/secret/credential/API key/access key before persisting a store record.

## Mixed File and PostgreSQL Datastores

The application runtime routes each record area independently. Areas omitted from `datastores` and areas configured as `file` use `LocalDataStore` under `data/<area>/<key>.json`. The checked-in runtime configuration routes users, groups, organizations, user environments, and ACLs to PostgreSQL; stores and virtual machines remain local. Configure a PostgreSQL-backed area with its type and an optional table name:

```json
{
  "datastores": {
    "users": {
      "type": "postgres",
      "table": "users"
    },
    "organizations": { "type": "postgres" },
    "user-environments": {
      "type": "postgres"
    }
  }
}
```

Each configured PostgreSQL area uses its own table with `id TEXT PRIMARY KEY` and `data JSONB NOT NULL`; the datastore key is stored in `id` and the complete JSON record in `data`. Table names default to the area name, with hyphens normalized to underscores (for example `user-environments` becomes `user_environments`), and must be simple PostgreSQL identifiers. The runtime shares one connection pool across PostgreSQL areas. The service creates missing tables on startup; [`sql/schema.sql`](../../sql/schema.sql) also provides idempotent DDL for the standard areas.

Configure database connection details with the runtime variables `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_DBNAME`, `DATABASE_USER`, and `DATABASE_PASSWORD`. These are read only when at least one area uses PostgreSQL. All five values are required, and `DATABASE_PORT` must be between 1 and 65535; startup fails if configuration is incomplete or database/table initialization fails. Set these values in the deployment environment or secret provider, never in committed JSON. Use a PostgreSQL role with only the permissions required to create and access the configured tables.

The same `read`, `write`, `list`, and `delete` datastore interface is used by bootstrap and plugins regardless of backend. Writes upsert JSON records. Delete preserves the existing local-store contract by replacing a record's data with `{}` rather than removing its row. SQL-backed areas are persistent PostgreSQL tables; this is separate from `UniversalConnectionManager`, whose SQL mode remains an in-memory prototype.

Changing an area's backend does not migrate or copy existing records. Plan and perform any local JSON-to-PostgreSQL data migration before switching that area's `type`; otherwise the runtime reads from the newly selected backend, which may initially be empty.

## LocalDataStore Layout

`LocalDataStore(rootDir)` maps each call to a JSON file:

```text
<rootDir>/<area>/<key>.json
```

- `read(area, key)` returns parsed JSON, `null` for missing files, and also `null` for invalid JSON.
- `write(area, key, value)` replaces that record with pretty-printed JSON.
- `list(area)` returns basenames without `.json`.
- `delete(area, key)` writes `{}` rather than removing the file; callers should treat the empty record as deleted.

Writes are synchronous filesystem operations wrapped in async methods. There is no transaction, locking, schema validation, or database durability guarantee in this implementation.

## Identity and Authorization Records

Organization:

```json
{ "id": "org-platform", "name": "Platform Organization" }
```

Group:

```json
{ "id": "platform-readers", "name": "Platform Readers", "organizationId": "org-platform" }
```

User:

```json
{
  "id": "monitorer",
  "username": "monitorer",
  "email": "monitorer@example.com",
  "organizationId": "org-platform",
  "groupIds": ["platform-readers"],
  "roles": ["reader"]
}
```

ACL record:

```json
{
  "id": "monitorer-read-only",
  "subjectType": "user",
  "subjectId": "monitorer",
  "resourceType": "*",
  "resourceId": "*",
  "action": "read",
  "effect": "allow",
  "organizationId": "org-platform"
}
```

`roles` is descriptive metadata; `AccessControlPlugin` does not use it to authorize. Group membership is read from `user.groupIds`. ACL evaluation details and current enforcement limitations are in [Authorization](authorization.md).

## Per-user Secret Environment

The record ID is `<userId>-<environmentName>` in area `user-environments`:

```json
{
  "id": "monitorer-dev",
  "userId": "monitorer",
  "name": "dev",
  "organizationId": "org-platform",
  "secretRefs": [
    { "key": "DB_PASSWORD", "store": "secretario", "path": "app/monitorer/dev" }
  ]
}
```

`store` must name an entry under `stores`; `path` is provider-relative. Secretario defaults to KV v2 and uses `kv.mount` and `kv.dataPath`. Runtime values returned by `resolveUserEnvironment()` are not persisted by the secrets manager.

## VM Definition

Area is `virtual-machines`; each record has an `id`, display `name`, provider/protocol, connection data, spec, and state. Example:

```json
{
  "id": "demo-web-aws",
  "name": "demo-web-aws",
  "provider": "AWS",
  "apiType": "ec2.create_instances",
  "connection": { "region": "us-east-1", "endpoint": "https://ec2.us-east-1.amazonaws.com" },
  "spec": { "instanceType": "t3.micro", "imageId": "ami-example" },
  "state": "stopped"
}
```

Railway sample (`MCP_001`) uses `${ENV}` placeholders for connection fields. The API token is never stored in the definition; the provider reads `RAILWAY_TOKEN` / `RAILWAY_API_TOKEN` from `process.env` at action time.

```json
{
  "id": "MCP_001",
  "name": "MCP_001",
  "provider": "RAILWAY",
  "apiType": "railway.serviceCreate",
  "connection": {
    "endpoint": "${RAILWAY_API_ENDPOINT}",
    "projectId": "${RAILWAY_PROJECT_ID}",
    "environmentId": "${RAILWAY_ENVIRONMENT_ID}",
    "projectName": "skillful-sparkle"
  },
  "spec": { "serviceName": "MCP_001", "image": "${RAILWAY_MCP_001_IMAGE}", "sourceType": "image" },
  "state": "stopped"
}
```

Do not use real credentials in VM fixtures. VM action results update `state`, `lastAction`, and `remoteResponse`; Railway create also stores `connection.serviceId` for later start/stop/delete. Delete writes an empty `{}` record through `LocalDataStore.delete()`.

## Other In-memory Shapes

- `McpHub`: `{ id, name, transport, metadata, status, createdAt }`; registry is a `Map` keyed by `id`.
- `UniversalConnectionManager.connect(area, config)`: `config.type` is `file` or `sql`. File config has `path`; SQL config has `connectionString` and optional `database`. The current SQL adapter is an in-memory fixture, not a driver.
- Logger event: `{ timestamp, level, service, instance, message, metadata? }`; one daily file per service/instance.