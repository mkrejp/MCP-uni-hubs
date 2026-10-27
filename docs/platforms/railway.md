# Railway Runtime Guide

## Scope

This is operational context for Railway's repository/deployment agents. The repository currently has no `railway.json`, `railway.toml`, Dockerfile, or committed Railway-specific build definition. Do not invent a deployment contract without a task requiring one.

## Service Process

The web dashboard process is the Railway-facing HTTP service:

```bash
npm run web
```

`src/web-server.js` reads `PORT` (default `3000`) and `HOST` (default `0.0.0.0`). Railway provides `PORT`; preserve this binding behavior. `npm start` is a CLI summary process and does not keep an HTTP server open, so it is not the web service start command.

## Required and Optional Variables

| Variable | Use | Notes |
| --- | --- | --- |
| `SECRETARIO_TOKEN` | Secretario Vault token | Required for successful authenticated secret fetches; referenced in `config/app.env.json`, never commit its value. |
| `PORT` | HTTP listener port | Supplied by Railway; do not hardcode a deployed port. |
| `HOST` | HTTP bind address | Defaults to `0.0.0.0`, required for container reachability. |
| `LOG_LEVEL` | Logger threshold | One of `DEBUG`, `INFO`, `WARN`, `ERROR`, `CRITICAL`; defaults to `INFO`. |
| `LOG_DIR` | Log directory | Defaults to `./logs`; container filesystem may be ephemeral. |
| `INSTANCE_ID` | Logger instance label | Defaults to `default-instance`. |
| `SERVICE_NAME` | Logger service label | Defaults to `app`. |

Set secrets in Railway service variables or a compatible runtime secret mechanism. Never paste secret values into source, docs, build args, or committed `.env` files.

## Persistence and Security Caveats

- `LocalDataStore` writes to the repository-relative `data/` directory. Container filesystems may be ephemeral; if records must survive deployments, configure an appropriate Railway volume and verify its mount path against the deployed working directory.
- The dashboard exposes users and configuration metadata and currently has no authentication middleware. Do not expose it publicly as an admin surface until access control/authentication is implemented at the HTTP boundary.
- `GET /api/dashboard` reports stores as configured; it does not perform remote health checks.
- Only Secretario currently performs a real remote secret fetch. VM provider handlers and SQL connections are prototypes; do not describe them as live integrations.

## Operational Checks

1. Confirm the service start command is `npm run web`.
2. Confirm Railway's `PORT` is passed through and the process listens on `0.0.0.0`.
3. Configure `SECRETARIO_TOKEN` in Railway variables if the service must fetch secrets.
4. Decide whether local `data/` must persist; configure and validate a volume if required.
5. Keep the dashboard private until authenticated access is available.
6. Use deployment logs to diagnose startup errors, but never print environment values or Vault response secrets.