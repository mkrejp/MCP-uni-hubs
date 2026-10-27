---
name: railway-operations
description: "Deploy, configure, or troubleshoot this Node.js service on Railway."
---

# Railway Operations

1. Read [Railway runtime guidance](../../../docs/platforms/railway.md) and the top-level `AGENTS.md`; do not load unrelated architecture references.
2. Verify the service start command is `npm run web`; `npm start` is a short-lived CLI summary.
3. Preserve Railway's `PORT` and bind to `0.0.0.0`. Do not invent a manifest; no Railway deployment file is committed.
4. Require `SECRETARIO_TOKEN` as a Railway runtime variable when remote Secretario secret reads are needed. Never print or persist its value.
5. Account for ephemeral filesystem behavior and validate any volume mount before relying on local JSON data for durability.
6. Keep the dashboard private: it currently has no authentication middleware. Do not equate configured secret stores with healthy/reachable stores.
7. Diagnose with startup logs and safe status output only; do not dump environment variables or secret payloads.