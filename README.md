# MCP Uni Hubs

Dependency-light Node.js application for MCP hub registry behavior, plugins, local JSON data, access-control prototypes, secret resolution, and a read-only operations dashboard.

## Run

```bash
npm test
npm start
npm run cli
```

`npm start` (same as `npm run web`) serves the dashboard. Locally it listens on port 3000 by default (`PORT` / `HOST` override). On Railway the container listens on `PORT` (commonly 8080); public HTTPS is [https://mcp.animarium.ai](https://mcp.animarium.ai) on the Railway edge (`:443`) — do not use `:8080` on the custom domain. The dashboard reports configured secret stores, not live connectivity, has no authentication, and should not be exposed as an administrative surface.

Runtime secrets (never commit values):

- `SECRETARIO_TOKEN` — Secretario Vault token
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret (this exact name)

## Documentation

- [Agent and tool routing](AGENTS.md)
- [Task-based documentation map](docs/README.md)
- [Architecture index](docs/architecture.md)
- [Detailed architecture references](docs/architecture/)
- [Railway operations](docs/platforms/railway.md)

## Source Map

| Path | Contents |
| --- | --- |
| `src/` | Runtime, domain services, datastore, configuration, web server |
| `plugins/` | Auto-discovered plugin factories |
| `config/` | Shared runtime config and identity bootstrap records |
| `data/` | Local application records; preserve user changes |
| `public/` | Dashboard browser assets |
| `tests/` | Node.js built-in test suite |
| `.cursor/rules/` | Cursor task-scoped context rules |
| `.github/instructions/`, `.github/skills/` | GitHub Copilot rules and on-demand workflows |
