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

Do not use real credentials in VM fixtures. VM action results update `state`, `lastAction`, and `remoteResponse`; delete writes an empty `{}` record through `LocalDataStore.delete()`.

## Other In-memory Shapes

- `McpHub`: `{ id, name, transport, metadata, status, createdAt }`; registry is a `Map` keyed by `id`.
- `UniversalConnectionManager.connect(area, config)`: `config.type` is `file` or `sql`. File config has `path`; SQL config has `connectionString` and optional `database`. The current SQL adapter is an in-memory fixture, not a driver.
- Logger event: `{ timestamp, level, service, instance, message, metadata? }`; one daily file per service/instance.