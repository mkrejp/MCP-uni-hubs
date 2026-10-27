import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function resolveEnvironmentValues(value) {
  if (typeof value === 'string') {
    return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name) => process.env[name] || '');
  }
  if (Array.isArray(value)) {
    return value.map(resolveEnvironmentValues);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveEnvironmentValues(item)]));
  }
  return value;
}

function redactStoreCredentials(value) {
  if (Array.isArray(value)) {
    return value.map(redactStoreCredentials);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/(token|password|secret|credential|api.?key|access.?key)/i.test(key))
    .map(([key, item]) => [key, redactStoreCredentials(item)]));
}

export class ConfigLoader {
  constructor(filePath = './config/app.env.json') {
    this.filePath = resolve(filePath);
  }

  async load() {
    if (!existsSync(this.filePath)) {
      throw new Error(`Environment config file not found: ${this.filePath}`);
    }

    const raw = readFileSync(this.filePath, 'utf8');
    return resolveEnvironmentValues(JSON.parse(raw));
  }
}

export async function loadEnvironmentConfig(filePath = './config/app.env.json') {
  const loader = new ConfigLoader(filePath);
  return loader.load();
}

export async function bootstrapEnvironmentData(datastore, config = {}) {
  if (!datastore || !config) {
    return null;
  }

  const writes = [];

  if (config.stores) {
    for (const [storeName, storeConfig] of Object.entries(config.stores)) {
      const persistedStoreConfig = redactStoreCredentials(storeConfig);
      if (Object.keys(persistedStoreConfig.headers || {}).length === 0) {
        delete persistedStoreConfig.headers;
      }
      writes.push(['stores', storeName, persistedStoreConfig]);
    }
  }

  const areaAliases = {
    organizations: ['organizations'],
    groups: ['groups'],
    users: ['users'],
    'user-environments': ['userEnvironments', 'user-environments'],
    acls: ['acls'],
  };

  for (const [area, aliases] of Object.entries(areaAliases)) {
    const entries = aliases.flatMap((key) => Array.isArray(config[key]) ? config[key] : []);
    for (const entry of entries) {
      const key = entry.id || entry.name;
      if (key) {
        writes.push([area, key, entry]);
      }
    }
  }

  for (const [area, key, value] of writes) {
    await datastore.write(area, key, value);
  }

  return { written: writes.length };
}
