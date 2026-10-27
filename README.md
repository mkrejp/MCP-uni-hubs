# MCP Uni Hubs

Dependency-light Node.js application for MCP hub registry behavior, plugins, local JSON data, access-control prototypes, secret resolution, and a read-only operations dashboard.

## Run

```bash
npm test
npm start
npm run cli
```

`npm start` (same as `npm run web`) serves the site. Locally it listens on port 3000 by default (`PORT` / `HOST` override). On Railway the container listens on `PORT` (commonly 8080); public HTTPS is [https://mcp.animarium.ai](https://mcp.animarium.ai) on the Railway edge (`:443`) — do not use `:8080` on the custom domain. Unauthenticated visitors see only the Sign in with Google page; the control-plane dashboard HTML/JS/CSS and `/api/dashboard` require a signed session. It reports configured secret stores, not live connectivity.

Runtime secrets (never commit values):

- `SECRETARIO_TOKEN` — Secretario Vault token
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret (this exact name; not `GOOGLE_SECRET`)
- `SESSION_SECRET` — HMAC key for the signed session cookie

## Google authentication (Railway)

Set these runtime variables on the Railway service `mcp-uni-hubs`:

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret (name must be exactly this; not `GOOGLE_SECRET`) |
| `SESSION_SECRET` | HMAC key for the signed session cookie |
| `PUBLIC_BASE_URL` | Canonical public origin (no trailing slash), e.g. `https://mcp.animarium.ai` |

Register this redirect URI in Google Cloud Console:

```text
{PUBLIC_BASE_URL}/auth/google/callback
```

Only Google accounts with a **verified** email that matches an existing datastore user (`data/users/*.json`, case-insensitive) can sign in. Unmatched emails are denied; users are never auto-created from Google. When `GOOGLE_CLIENT_ID` is unset, `GET /auth/google` returns HTTP 503.

### Railway VM orchestration (mcp-uni-hubs service)

Sample user `userrail` and VM definition `MCP_001` target Railway project **skillful-sparkle**. Connection secrets and IDs come from container runtime variables only (never committed JSON):

| Variable | Required | Purpose |
| --- | --- | --- |
| `RAILWAY_TOKEN` | Yes* | Railway GraphQL API token (preferred). |
| `RAILWAY_API_TOKEN` | Yes* | Alias used when `RAILWAY_TOKEN` is unset. |
| `RAILWAY_PROJECT_ID` | For `MCP_001` | Project id (`f9236355-ad59-41ce-a087-a359d15c0025` for skillful-sparkle). |
| `RAILWAY_ENVIRONMENT_ID` | For `MCP_001` | Environment id (`efca1cc9-6d2a-4013-b160-7c21e06623c8` for production). |
| `RAILWAY_API_ENDPOINT` | No | Defaults to `https://backboard.railway.com/graphql/v2`. |
| `RAILWAY_MCP_001_IMAGE` | Usually | Docker image for create; alternatively `RAILWAY_MCP_001_REPO`. |

\* One of `RAILWAY_TOKEN` or `RAILWAY_API_TOKEN` is required for live Railway create/start/stop/delete.

See [docs/platforms/railway.md](docs/platforms/railway.md) for the full variable list.

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
