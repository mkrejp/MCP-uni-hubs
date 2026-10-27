# Agent Guide

## Project

MCP Uni Hubs is a dependency-light Node.js application using native ES modules. It provides hub registry behavior, plugins, JSON-backed application data, access control, secret resolution, and a small operational dashboard.

## Start Here

1. Read [docs/architecture.md](docs/architecture.md) for the application flow and known integration boundaries.
2. Read [README.md](README.md) for commands and usage examples.
3. Before editing configuration or security-sensitive code, read the matching rules in `.github/instructions/`.
4. For plugin work, use [.github/skills/plugin-development/SKILL.md](.github/skills/plugin-development/SKILL.md). For secret-store work, use [.github/skills/configure-secret-store/SKILL.md](.github/skills/configure-secret-store/SKILL.md).

## Useful Commands

```bash
npm test
npm start
npm run web
```

`npm run web` serves the dashboard on port 3000 by default. `PORT` and `HOST` can override the listener.

## Repository Map

- `src/`: core services, startup runtime, configuration, and server code
- `plugins/`: auto-discovered plugin entry points
- `config/app.env.json`: shared app, store, identity, environment, and ACL configuration
- `data/`: local JSON datastore records
- `public/`: dashboard HTML, CSS, and browser JavaScript
- `tests/`: Node.js built-in test runner suite
- `docs/`: architecture and implementation notes

## Working Rules

- Follow existing JavaScript ES module and Node.js built-in API patterns; avoid adding dependencies without a concrete need.
- Keep tests focused and run `npm test` after behavior changes.
- Never commit tokens, passwords, private keys, or real cloud credentials. Secretario credentials come from the runtime `SECRETARIO_TOKEN` variable.
- Treat `tmp/` and `logs/` as generated data. Do not include them in changes.
- Do not describe a configured store as reachable: current dashboard status means configured, not health-checked.
- Preserve existing user data and unrelated working-tree changes.