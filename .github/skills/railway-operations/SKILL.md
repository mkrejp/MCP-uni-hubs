---
name: railway-operations
description: "Deploy, configure, or troubleshoot this Node.js service on Railway."
---

# Railway Operations

1. Read [Railway runtime guidance](../../../docs/platforms/railway.md) and the top-level `AGENTS.md`; do not load unrelated architecture references.
2. Verify the service start command is `npm start` (from `railway.toml`); `npm run cli` is the short-lived CLI summary.
3. Preserve Railway's `PORT` and bind to `0.0.0.0`. Deploy start is defined in committed `railway.toml`.
4. Require `SECRETARIO_TOKEN` and Google OAuth vars (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `PUBLIC_BASE_URL`) as Railway runtime variables when those features are needed. Never print or persist values.
5. Account for ephemeral filesystem behavior and validate any volume mount before relying on local JSON data for durability.
6. Dashboard HTML/API require a signed Google session; do not equate configured secret stores with healthy/reachable stores.
7. Diagnose with startup logs and safe status output only; do not dump environment variables or secret payloads.