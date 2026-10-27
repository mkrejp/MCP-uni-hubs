import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export class UniversalConnectionManager {
  constructor() {
    this.connections = new Map();
    this.sqlStores = new Map();
  }

  connect(areaName, config = {}) {
    const type = String(config.type || 'file').toLowerCase();

    if (!['sql', 'file'].includes(type)) {
      throw new Error(`Unsupported data connection type: ${config.type}`);
    }

    const connection = {
      area: areaName,
      type,
      connectedAt: new Date().toISOString(),
      ...config,
    };

    if (type === 'sql') {
      const database = config.database ?? areaName;
      connection.database = database;
      this.sqlStores.set(areaName, {
        database,
        rows: [{ status: 'ok' }, { status: 'pending' }],
        connectionString: config.connectionString ?? `postgres://localhost/${database}`,
      });
    }

    this.connections.set(areaName, connection);
    return connection;
  }

  getConnection(areaName) {
    const connection = this.connections.get(areaName);
    if (!connection) {
      throw new Error(`No connection configured for data area: ${areaName}`);
    }

    return connection;
  }

  async read(areaName, key) {
    const connection = this.getConnection(areaName);

    if (connection.type === 'sql') {
      const store = this.sqlStores.get(areaName);
      if (!store) {
        return null;
      }

      if (typeof key === 'string') {
        return store.rows.find((row) => row && row.id === key) ?? null;
      }

      return store.rows;
    }

    const filePath = this.resolveFilePath(areaName, connection);
    const data = this.readJsonFile(filePath);
    return key in data ? data[key] : null;
  }

  async write(areaName, key, value) {
    const connection = this.getConnection(areaName);

    if (connection.type === 'sql') {
      const store = this.sqlStores.get(areaName) ?? { database: connection.database, rows: [] };
      const existingIndex = store.rows.findIndex((row) => row && row.id === key);

      if (existingIndex >= 0) {
        store.rows[existingIndex] = { ...store.rows[existingIndex], ...value };
      } else {
        store.rows.push({ id: key, ...value });
      }

      this.sqlStores.set(areaName, store);
      return value;
    }

    const filePath = this.resolveFilePath(areaName, connection);
    const data = this.readJsonFile(filePath);
    data[key] = value;
    this.writeJsonFile(filePath, data);
    return value;
  }

  async query(areaName, query, params = []) {
    const connection = this.getConnection(areaName);

    if (connection.type !== 'sql') {
      throw new Error(`Area ${areaName} is not configured as a SQL connection.`);
    }

    const store = this.sqlStores.get(areaName);
    if (!store) {
      return [];
    }

    const normalized = String(query || '').trim();
    const boundParams = Array.isArray(params) ? params : [params];

    if (normalized.includes('WHERE status = ?')) {
      const value = boundParams[0];
      return store.rows.filter((row) => row.status === value);
    }

    if (normalized.includes('WHERE id = ?')) {
      const value = boundParams[0];
      return store.rows.filter((row) => row.id === value);
    }

    if (normalized.startsWith('SELECT * FROM')) {
      return [...store.rows];
    }

    return [];
  }

  resolveFilePath(areaName, connection) {
    const filePath = connection.path ?? `./data/${areaName}.json`;
    const absolutePath = resolve(filePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    if (!existsSync(absolutePath)) {
      writeFileSync(absolutePath, '{}', 'utf8');
    }
    return absolutePath;
  }

  readJsonFile(filePath) {
    try {
      const raw = readFileSync(filePath, 'utf8');
      if (!raw.trim()) {
        return {};
      }
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  writeJsonFile(filePath, data) {
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}
