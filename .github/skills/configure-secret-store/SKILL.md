---
name: configure-secret-store
description: "Configure a secrets provider, per-user secret references, or safe secret retrieval behavior."
---

# Configure a Secret Store

Use this workflow for changes to `config/app.env.json`, `src/config-loader.js`, `src/secrets-manager.js`, or user environment records.

1. Read `AGENTS.md`, `docs/architecture.md`, and the applicable `.github/instructions/configuration.instructions.md` rules.
2. Put connection metadata in `stores.<store-id>` and credentials only in runtime environment variables, referenced as `${VARIABLE_NAME}`.
3. Put per-user secret mappings in that user's `userEnvironments` record using `secretRefs` with `key`, `store`, and `path`.
4. For the existing Secretario KV v2 backend, preserve the configured address, mount, data path, and `X-Vault-Token` behavior. Do not invent a health status; current status means configured only.
5. Ensure store credentials are stripped before datastore persistence and never included in dashboard/API serialization or logs.
6. Test with `node:test`, a synthetic token, and a mocked fetch response. Assert both successful resolution and that credential values do not persist.
7. Run `npm test` and scan the staged diff for accidental secrets.

Do not connect to a real vault or print the runtime token during tests or debugging.