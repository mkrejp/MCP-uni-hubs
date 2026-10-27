import { Pool } from 'pg';
import { LocalDataStore } from './local-data-store.js';

const DEFAULT_TABLE_NAMES = {
  'user-environments': 'user_environments',
  'virtual-machines': 'virtual_machines',
};
const STANDARD_DATASTORE_AREAS = [
  'organizations',
  'groups',
  'users',
  'stores',
  'user-environments',
  'acls',
  'virtual-machines',
];

function resolveTableName(area, table) {
  const tableName = table || DEFAULT_TABLE_NAMES[area] || area.replaceAll('-', '_');
  if (tableName.length > 63 || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    throw new Error(`Invalid PostgreSQL table name configured for datastore "${area}"`);
  }
  return tableName;
}

export function getDatastoreRoutes(areas = {}) {
  areas ||= {};
  const allAreas = [...new Set([...STANDARD_DATASTORE_AREAS, ...Object.keys(areas)])];
  return allAreas.map((area) => {
    const config = areas[area];
    const type = String(config?.type || 'file').toLowerCase();
    if (type !== 'file' && type !== 'postgres') {
      throw new Error(`Unsupported datastore type "${type}" for area "${area}"`);
    }

    return type === 'postgres'
      ? {
        area,
        backend: 'PostgreSQL',
        location: `Table: ${resolveTableName(area, config.table)}`,
      }
      : {
        area,
        backend: 'Local files',
        location: `data/${area}/*.json`,
      };
  });
}

export function getPostgresConfigFromEnvironment(environment = process.env) {
  const keys = ['DATABASE_HOST', 'DATABASE_PORT', 'DATABASE_DBNAME', 'DATABASE_USER', 'DATABASE_PASSWORD'];
  const missing = keys.filter((key) => environment[key] === undefined || environment[key] === '');
  if (missing.length > 0) {
    throw new Error(`Missing PostgreSQL runtime variables: ${missing.join(', ')}`);
  }

  const port = Number(environment.DATABASE_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DATABASE_PORT must be an integer between 1 and 65535');
  }

  return {
    host: String(environment.DATABASE_HOST).trim(),
    port,
    database: String(environment.DATABASE_DBNAME).trim(),
    user: String(environment.DATABASE_USER).trim(),
    password: String(environment.DATABASE_PASSWORD),
  };
}

/**
 * Route datastore areas to local JSON files or PostgreSQL JSONB tables.
 */
export class ConfiguredDataStore {
  constructor({
    rootDir = './data',
    areas = {},
    databaseConfig,
    poolFactory = (options) => new Pool(options),
  } = {}) {
    this.localStore = new LocalDataStore(rootDir);
    this.postgresAreas = new Map();
    this.pools = new Set();
    this.pool = null;
    this.description = 'Local JSON datastore';
    const tableOwners = new Set();

    for (const [area, config] of Object.entries(areas)) {
      const type = String(config?.type || 'file').toLowerCase();
      if (type === 'file') {
        continue;
      }
      if (type !== 'postgres') {
        throw new Error(`Unsupported datastore type "${type}" for area "${area}"`);
      }

      if (!databaseConfig) {
        throw new Error(`PostgreSQL runtime variables are required for datastore "${area}"`);
      }

      const table = resolveTableName(area, config.table);
      if (tableOwners.has(table)) {
        throw new Error(`PostgreSQL table "${table}" is configured for more than one datastore area`);
      }
      tableOwners.add(table);

      if (!this.pool) {
        this.pool = poolFactory({ ...databaseConfig, allowExitOnIdle: true });
        this.pools.add(this.pool);
      }
      this.postgresAreas.set(area, { pool: this.pool, table });
    }

    if (this.postgresAreas.size > 0) {
      this.description = 'Area-routed JSON and PostgreSQL datastores';
    }
  }

  async initialize() {
    for (const [area, { pool, table }] of this.postgresAreas) {
      try {
        await pool.query(
          `CREATE TABLE IF NOT EXISTS "${table}" (id TEXT PRIMARY KEY, data JSONB NOT NULL)`,
        );
      } catch (error) {
        throw new Error(`Unable to initialize PostgreSQL datastore "${area}"`, { cause: error });
      }
    }
  }

  async read(area, key) {
    const postgresArea = this.postgresAreas.get(area);
    if (!postgresArea) {
      return this.localStore.read(area, key);
    }

    const { rows } = await postgresArea.pool.query(
      `SELECT data FROM "${postgresArea.table}" WHERE id = $1`,
      [key],
    );
    return rows[0]?.data ?? null;
  }

  async write(area, key, value) {
    const postgresArea = this.postgresAreas.get(area);
    if (!postgresArea) {
      return this.localStore.write(area, key, value);
    }

    await postgresArea.pool.query(
      `INSERT INTO "${postgresArea.table}" (id, data) VALUES ($1, $2::jsonb) `
        + 'ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data',
      [key, JSON.stringify(value)],
    );
    return value;
  }

  async list(area) {
    const postgresArea = this.postgresAreas.get(area);
    if (!postgresArea) {
      return this.localStore.list(area);
    }

    const { rows } = await postgresArea.pool.query(
      `SELECT id FROM "${postgresArea.table}" ORDER BY id`,
    );
    return rows.map(({ id }) => id);
  }

  async delete(area, key) {
    const postgresArea = this.postgresAreas.get(area);
    if (!postgresArea) {
      return this.localStore.delete(area, key);
    }

    const { rowCount } = await postgresArea.pool.query(
      `UPDATE "${postgresArea.table}" SET data = '{}'::jsonb WHERE id = $1`,
      [key],
    );
    return rowCount > 0;
  }

  async close() {
    await Promise.all([...this.pools].map((pool) => pool.end()));
  }
}

export function createConfiguredDataStore({
  rootDir,
  areas,
  databaseConfig,
  poolFactory,
} = {}) {
  return new ConfiguredDataStore({ rootDir, areas, databaseConfig, poolFactory });
}
