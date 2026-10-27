# MCP-uni-hubs

MCP hubs engine prototype.

This workspace contains a lightweight registry for managing Model Context Protocol hubs. It is intentionally small and dependency-free so it can act as a starting point for a larger orchestration service.

## Getting started

```bash
npm test
npm start
```

Start the web control-plane dashboard with:

```bash
npm run web
```

The dashboard is served at `http://localhost:3000`. It shows the active application configuration, loaded plugins, configured secret stores, and datastore users. Secret store credentials are not included in the dashboard API response.

## Project structure

- [src/hub-engine.js](src/hub-engine.js): hub definitions and registry behavior
- [src/index.js](src/index.js): CLI entry point for the demo
- [src/web-server.js](src/web-server.js): web dashboard server
- [src/app-runtime.js](src/app-runtime.js): shared application startup and dashboard data
- [tests/hub-engine.test.js](tests/hub-engine.test.js): smoke tests for the registry
- [AGENTS.md](AGENTS.md): repository guide for AI coding agents
- [docs/architecture.md](docs/architecture.md): startup flow, components, and current integration boundaries
- [.github/copilot-instructions.md](.github/copilot-instructions.md): repository-wide Copilot rules
- [.github/skills](.github/skills): focused workflows for plugin and secret-store changes

## Universal connection manager

The project includes a shared data abstraction for application data areas, so each area can connect to either a SQL database or a local file store through one interface.

```js
import { UniversalConnectionManager } from './src/data-connection-manager.js';

const manager = new UniversalConnectionManager();

manager.connect('analytics', {
  type: 'sql',
  connectionString: 'postgres://user:pass@localhost/app',
  database: 'analytics',
});

manager.connect('reports', {
  type: 'file',
  path: './data/reports.json',
});

await manager.write('reports', 'daily-overview', { total: 42, status: 'ok' });
const payload = await manager.read('reports', 'daily-overview');
const rows = await manager.query('analytics', 'SELECT * FROM events WHERE status = ?', ['ok']);
```

## Local datastore and startup plugin loading

The app also includes a local JSON datastore and a plugin loader that scans configured directories at startup.

The Secretario token is read from the `SECRETARIO_TOKEN` environment variable. It is not stored in the repository or persisted datastore.

```js
import { LocalDataStore, PluginLoader } from './src/local-data-store.js';

const datastore = new LocalDataStore('./data');
await datastore.write('users', 'demo-user', { id: 'demo-user', email: 'demo@example.com' });

const loader = new PluginLoader({
  pluginDirectories: ['./plugins'],
  appContext: { datastore },
});

const plugins = await loader.loadAll();
console.log(plugins.map((plugin) => plugin.name));
```

This keeps application data in a persistent folder structure using JSON files and enables plugin modules to register themselves during application startup.

## Logging configuration

The app includes a config-driven logger that writes one log file per day and instance. The accepted levels are `DEBUG`, `INFO`, `WARN`, `ERROR`, and `CRITICAL`.

```js
import { AppLogger } from './src/logger.js';

const logger = new AppLogger({
  level: 'INFO',
  logDir: './logs',
  instanceId: 'instance-42',
  serviceName: 'app',
});

logger.info('Application started');
logger.warn('Resource degraded');
logger.error('Something failed');
```

The logger creates files named like:

```text
./logs/app-2026-10-27-instance-42.log
```

You can also configure logging via environment variables:

```bash
export LOG_LEVEL=DEBUG
export LOG_DIR=./logs
export INSTANCE_ID=instance-42
```

## VM orchestration plugin

The project includes a first VM orchestration plugin that loads VM definitions from the datastore and dispatches create/start/stop/delete calls according to the configured provider protocol. Supported providers include AWS, GCP, Azure, VMware, IBM VPC, IBM PowerVC, and OpenStack.

Example VM definition stored in the datastore:

```json
{
  "id": "demo-web-aws",
  "name": "demo-web-aws",
  "provider": "AWS",
  "apiType": "ec2.create_instances",
  "connection": {
    "region": "us-east-1",
    "accessKeyId": "demo-access-key",
    "secretAccessKey": "demo-secret-key",
    "endpoint": "https://ec2.us-east-1.amazonaws.com"
  },
  "spec": {
    "instanceType": "t3.micro",
    "imageId": "ami-12345678"
  },
  "state": "stopped"
}
```

The plugin reads these definitions from `./data/virtual-machines/*.json` and exposes methods such as `createVm(id)`, `startVm(id)`, `stopVm(id)`, and `deleteVm(id)`.

## Example output

```json
{
  "status": {
    "total": 3,
    "healthy": 2,
    "degraded": 1,
    "offline": 0
  },
  "hubs": [
    { "id": "docs-hub", "name": "Docs Hub", "transport": "http", "status": "healthy" },
    { "id": "runtime-hub", "name": "Runtime Hub", "transport": "stdio", "status": "healthy" },
    { "id": "watcher-hub", "name": "Watcher Hub", "transport": "sse", "status": "degraded" }
  ]
}
```
