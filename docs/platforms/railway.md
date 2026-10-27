# Railway Runtime Guide

## Scope

Operational context for Railway deployments of MCP Uni Hubs. A minimal [`railway.toml`](../../railway.toml) sets `deploy.startCommand` to `npm start` (the web dashboard). Dashboard service settings still apply for variables, domains, and volumes.

## Service Process

The default process is the long-running web dashboard:

```bash
npm start
# equivalent: npm run web / node src/web-server.js
```

`src/web-server.js` reads `PORT` (default `3000` locally) and `HOST` (default `0.0.0.0`). Railway supplies `PORT` (this service uses `8080`); preserve that binding. The short-lived CLI summary remains available as `npm run cli` (`node src/index.js`) and must not be used as the Railway start command.

Public HTTPS for this project is at [https://mcp.animarium.ai](https://mcp.animarium.ai) (Railway edge on `:443`). Clients should use that URL; do not expect `:8080` on the custom domain — that port is the container listener behind the edge.

## Required and Optional Variables

| Variable | Use | Notes |
| --- | --- | --- |
| `SECRETARIO_TOKEN` | Secretario Vault token | Required for successful authenticated secret fetches; referenced in `config/app.env.json`, never commit its value. |
| `DATABASE_HOST` | PostgreSQL server host | Required when one or more areas in `datastores` use `type: "postgres"`. |
| `DATABASE_PORT` | PostgreSQL server port | Required when PostgreSQL areas are configured; integer from 1 to 65535. |
| `DATABASE_DBNAME` | PostgreSQL database name | Required when PostgreSQL areas are configured. |
| `DATABASE_USER` | PostgreSQL application username | Required when PostgreSQL areas are configured. |
| `DATABASE_PASSWORD` | PostgreSQL application password | Required when PostgreSQL areas are configured. Store all database values as Railway variables/secrets, never in committed JSON. |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Required for Sign in with Google; unset → `/auth/google` returns 503. |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Exact name required (not `GOOGLE_SECRET`); never commit its value. |
| `SESSION_SECRET` | Signed session cookie HMAC key | Required for dashboard sessions after Google login. |
| `PUBLIC_BASE_URL` | Canonical public origin | No trailing slash; e.g. `https://mcp.animarium.ai`. Used for OAuth redirect URI. |
| `RAILWAY_TOKEN` | Railway public GraphQL API token | Preferred token for the `RAILWAY` VM provider. Set on the **mcp-uni-hubs** service variables. Never commit. |
| `RAILWAY_API_TOKEN` | Railway API token alias | Accepted if `RAILWAY_TOKEN` is unset. Same secret semantics. |
| `RAILWAY_API_ENDPOINT` | GraphQL endpoint | Optional; defaults to `https://backboard.railway.com/graphql/v2`. |
| `RAILWAY_PROJECT_ID` | Target Railway project id | Required for sample VM `MCP_001`. For project **skillful-sparkle** use `f9236355-ad59-41ce-a087-a359d15c0025`. |
| `RAILWAY_ENVIRONMENT_ID` | Target environment id | Required for `MCP_001`. Production: `efca1cc9-6d2a-4013-b160-7c21e06623c8`. |
| `RAILWAY_MCP_001_IMAGE` | Docker image for `MCP_001` create | Optional image source for `serviceCreate`; leave unset only when creating an empty service. |
| `RAILWAY_MCP_001_REPO` | GitHub repo for `MCP_001` create | Optional alternative to image (`owner/repo`). |
| `RAILWAY_SERVICE_ID` | Existing service id override | Optional; normally stored on the VM record after create. |
| `PORT` | HTTP listener port | Supplied by Railway (often `8080`); do not hardcode a deployed port. App defaults to `3000` only when unset. |
| `HOST` | HTTP bind address | Defaults to `0.0.0.0`, required for container reachability. |
| `LOG_LEVEL` | Logger threshold | One of `DEBUG`, `INFO`, `WARN`, `ERROR`, `CRITICAL`; defaults to `INFO`. |
| `LOG_DIR` | Log directory | Defaults to `./logs`; container filesystem may be ephemeral. |
| `INSTANCE_ID` | Logger instance label | Defaults to `default-instance`. |
| `SERVICE_NAME` | Logger service label | Defaults to `app`. |

Set secrets in Railway service variables or a compatible runtime secret mechanism. Never paste secret values into source, docs, build args, datastore JSON, or committed `.env` files. Railway VM connection fields in `data/virtual-machines/MCP_001.json` use `${…}` placeholders expanded from these runtime variables.

## Persistence and Security Caveats

- `LocalDataStore` writes to the repository-relative `data/` directory. Container filesystems may be ephemeral; if records must survive deployments, configure an appropriate Railway volume and verify its mount path against the deployed working directory.
- Areas configured for PostgreSQL use persistent tables on that database; other areas continue to use local JSON files. Set `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_DBNAME`, `DATABASE_USER`, and `DATABASE_PASSWORD` as Railway variables/secrets, and grant the app database role permissions to create and access configured tables. See [Data Models](../architecture/data-models.md) and [`sql/schema.sql`](../../sql/schema.sql).
- Dashboard HTML/JS/CSS and `/api/dashboard` require a signed Google session; unauthenticated visitors only see the login page. Only verified Google emails that match an existing datastore user can sign in.
- `GET /api/dashboard` reports stores as configured; it does not perform remote health checks.
- Secretario performs remote secret fetches. The Railway VM provider performs real GraphQL calls when `RAILWAY_TOKEN` (or `RAILWAY_API_TOKEN`) is set. `ConfiguredDataStore` uses a PostgreSQL driver for areas explicitly configured as `postgres`; the separate `UniversalConnectionManager` SQL mode remains an in-memory prototype.
- Application user `userrail` (group `railway-operators`) is bootstrapped with ACL access to the `vm-orchestrator` plugin for the `MCP_001` Railway sample.

## Operational Checks

1. Confirm the service start command is `npm start` (from `railway.toml` or the dashboard override).
2. Confirm Railway's `PORT` is passed through and the process listens on `0.0.0.0`.
3. Configure `SECRETARIO_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, and `PUBLIC_BASE_URL` in Railway variables; never commit values.
4. If any datastore area uses PostgreSQL, set all five `DATABASE_*` variables and grant table privileges.
5. For Railway VM orchestration (`MCP_001` / `userrail`), set `RAILWAY_TOKEN` (or `RAILWAY_API_TOKEN`), `RAILWAY_PROJECT_ID`, `RAILWAY_ENVIRONMENT_ID`, and usually `RAILWAY_MCP_001_IMAGE` on the mcp-uni-hubs service.
6. Decide whether local `data/` must persist; configure and validate a volume if required.
7. Confirm Google redirect URI is `{PUBLIC_BASE_URL}/auth/google/callback`.
8. Use deployment logs to diagnose startup errors, but never print environment values, Railway tokens, database connection strings, or Vault response secrets.
