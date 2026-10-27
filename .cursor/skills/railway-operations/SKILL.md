---
name: railway-operations
description: "Deploy or troubleshoot MCP Uni Hubs on Railway."
---

# Railway Operations

1. Read `docs/platforms/railway.md` and `AGENTS.md` only.
2. Use `npm run web` for the long-running service; preserve Railway `PORT` and `0.0.0.0` binding.
3. Set `SECRETARIO_TOKEN` through Railway runtime variables, never in source or build output.
4. Validate volume persistence if `data/` must survive redeployments.
5. Keep the dashboard private until HTTP authentication exists; do not report configured stores as connected.