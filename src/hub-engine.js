export class McpHub {
  constructor({ id, name, transport = 'stdio', metadata = {}, status = 'healthy' }) {
    this.id = id;
    this.name = name;
    this.transport = transport;
    this.metadata = metadata;
    this.status = status;
    this.createdAt = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      transport: this.transport,
      status: this.status,
      metadata: this.metadata,
      createdAt: this.createdAt,
    };
  }
}

export class HubRegistry {
  constructor() {
    this.hubs = new Map();
  }

  register(hub) {
    if (!(hub instanceof McpHub)) {
      throw new TypeError('A hub must be an instance of McpHub');
    }

    this.hubs.set(hub.id, hub);
    return hub;
  }

  get(id) {
    return this.hubs.get(id) ?? null;
  }

  list() {
    return [...this.hubs.values()];
  }

  remove(id) {
    const hub = this.hubs.get(id);
    this.hubs.delete(id);
    return hub ?? null;
  }

  status() {
    return {
      total: this.hubs.size,
      healthy: this.list().filter((hub) => hub.status === 'healthy').length,
      degraded: this.list().filter((hub) => hub.status === 'degraded').length,
      offline: this.list().filter((hub) => hub.status === 'offline').length,
    };
  }
}

export function buildHubSummary(hubs) {
  return hubs.map((hub) => ({
    id: hub.id,
    name: hub.name,
    transport: hub.transport,
    status: hub.status,
  }));
}

export function createDefaultRegistry() {
  const registry = new HubRegistry();

  registry.register(
    new McpHub({
      id: 'docs-hub',
      name: 'Docs Hub',
      transport: 'http',
      metadata: { region: 'us-east-1', owner: 'platform' },
      status: 'healthy',
    }),
  );

  registry.register(
    new McpHub({
      id: 'runtime-hub',
      name: 'Runtime Hub',
      transport: 'stdio',
      metadata: { region: 'us-west-2', owner: 'runtime' },
      status: 'healthy',
    }),
  );

  registry.register(
    new McpHub({
      id: 'watcher-hub',
      name: 'Watcher Hub',
      transport: 'sse',
      metadata: { region: 'eu-central-1', owner: 'ops' },
      status: 'degraded',
    }),
  );

  return registry;
}
