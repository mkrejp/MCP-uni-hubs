---
name: configure-secret-store
description: "Configure a secrets provider or per-user secret mapping without persisting credentials."
---

# Configure a Secret Store

1. Read the applicable config rule and only `docs/architecture/data-models.md` plus the secret flow in `docs/architecture/runtime-flow.md`.
2. Use `${ENV_NAME}` placeholders; never put real credentials in config, data, logs, dashboard output, or tests.
3. Preserve Secretario KV v2 path and header behavior. Other backends are placeholders; store status is configured, not health-checked.
4. Ensure bootstrap redacts credentials before persistence. Test with synthetic tokens and mocked HTTP; run `npm test`.