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
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Required for Sign in with Google; unset → `/auth/google` returns 503. |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Exact name required (not `GOOGLE_SECRET`); never commit its value. |
| `SESSION_SECRET` | Signed session cookie HMAC key | Required for dashboard sessions after Google login. |
| `PUBLIC_BASE_URL` | Canonical public origin | No trailing slash; e.g. `https://mcp.animarium.ai`. Used for OAuth redirect URI. |
| `PORT` | HTTP listener port | Supplied by Railway (often `8080`); do not hardcode a deployed port. App defaults to `3000` only when unset. |
| `HOST` | HTTP bind address | Defaults to `0.0.0.0`, required for container reachability. |
| `LOG_LEVEL` | Logger threshold | One of `DEBUG`, `INFO`, `WARN`, `ERROR`, `CRITICAL`; defaults to `INFO`. |
| `LOG_DIR` | Log directory | Defaults to `./logs`; container filesystem may be ephemeral. |
| `INSTANCE_ID` | Logger instance label | Defaults to `default-instance`. |
| `SERVICE_NAME` | Logger service label | Defaults to `app`. |

Set secrets in Railway service variables or a compatible runtime secret mechanism. Never paste secret values into source, docs, build args, or committed `.env` files.

## Persistence and Security Caveats

- `LocalDataStore` writes to the repository-relative `data/` directory. Container filesystems may be ephemeral; if records must survive deployments, configure an appropriate Railway volume and verify its mount path against the deployed working directory.
- Dashboard HTML/JS/CSS and `/api/dashboard` require a signed Google session; unauthenticated visitors only see the login page. Only verified Google emails that match an existing datastore user can sign in.
- `GET /api/dashboard` reports stores as configured; it does not perform remote health checks.
- Only Secretario currently performs a real remote secret fetch. VM provider handlers and SQL connections are prototypes; do not describe them as live integrations.

## Operational Checks

1. Confirm the service start command is `npm start` (from `railway.toml` or the dashboard override).
2. Confirm Railway's `PORT` is passed through and the process listens on `0.0.0.0`.
3. Configure `SECRETARIO_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, and `PUBLIC_BASE_URL` in Railway variables; never commit values.
4. Decide whether local `data/` must persist; configure and validate a volume if required.
5. Confirm Google redirect URI is `{PUBLIC_BASE_URL}/auth/google/callback`.
6. Use deployment logs to diagnose startup errors, but never print environment values or Vault response secrets.
