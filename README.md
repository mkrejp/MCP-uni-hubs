# MCP Uni Hubs

Dependency-light Node.js application for MCP hub registry behavior, plugins, local JSON data, access-control prototypes, secret resolution, and a read-only operations dashboard.

## Run

```bash
npm test
npm start
npm run web
```

`npm run web` serves the dashboard on port 3000 by default. It reports configured secret stores, not live connectivity. Dashboard APIs require a signed-in Google session.

The Secretario token must be supplied as the runtime environment variable `SECRETARIO_TOKEN`; do not commit its value.

## Google authentication (Railway)

Set these runtime variables on the Railway service `mcp-uni-hubs`:

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `SESSION_SECRET` | HMAC key for the signed session cookie |
| `PUBLIC_BASE_URL` | Canonical public origin (no trailing slash), e.g. `https://….up.railway.app` |

Register this redirect URI in Google Cloud Console:

```text
{PUBLIC_BASE_URL}/auth/google/callback
```

Only Google accounts with a **verified** email that matches an existing datastore user (`data/users/*.json`, case-insensitive) can sign in. Unmatched emails are denied; users are never auto-created from Google. When `GOOGLE_CLIENT_ID` is unset, `GET /auth/google` returns HTTP 503.

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
