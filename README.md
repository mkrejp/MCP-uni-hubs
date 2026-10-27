# MCP Uni Hubs

Dependency-light Node.js application for MCP hub registry behavior, plugins, local JSON data, access-control prototypes, secret resolution, and a read-only operations dashboard.

## Run

```bash
npm test
npm start
npm run web
```

`npm run web` serves the dashboard on port 3000 by default. It reports configured secret stores, not live connectivity. The dashboard currently has no authentication and should not be exposed as an administrative surface.

The Secretario token must be supplied as the runtime environment variable `SECRETARIO_TOKEN`; do not commit its value.

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
