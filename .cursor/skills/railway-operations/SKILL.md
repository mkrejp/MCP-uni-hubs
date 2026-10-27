---
name: railway-operations
description: "Deploy or troubleshoot MCP Uni Hubs on Railway."
---

# Railway Operations

1. Read `docs/platforms/railway.md` and `AGENTS.md` only.
2. Use `npm start` (web dashboard via `railway.toml`) for the long-running service; preserve Railway `PORT` and `0.0.0.0` binding. `npm run cli` is the short-lived JSON summary.
3. Set `SECRETARIO_TOKEN`, Google OAuth (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`), `SESSION_SECRET`, and `PUBLIC_BASE_URL` through Railway runtime variables; never in source or build output.
4. Validate volume persistence if `data/` must survive redeployments.
5. Dashboard routes require a signed Google session; do not report configured stores as connected.