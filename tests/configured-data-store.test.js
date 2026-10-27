import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  createConfiguredDataStore,
  getDatastoreRoutes,
  getPostgresConfigFromEnvironment,
} from '../src/configured-data-store.js';
import { createApplicationRuntime } from '../src/app-runtime.js';

test('configured datastore routes areas to PostgreSQL tables or local JSON files', async () => {
  const calls = [];
  const closedPools = [];
  let poolCreations = 0;
  const poolOptions = [];
  const pool = {
    async query(text, values = []) {
      calls.push({ text, values });
      if (text.startsWith('SELECT data')) {
        return { rows: [{ data: { id: values[0] } }] };
      }
      if (text.startsWith('SELECT id')) {
        return { rows: [{ id: 'alpha' }, { id: 'beta' }] };
      }
      if (text.startsWith('UPDATE')) {
        return { rowCount: values[0] === 'missing' ? 0 : 1, rows: [] };
      }
      return { rowCount: 1, rows: [] };
    },
    async end() {
      closedPools.push(true);
    },
  };
  const store = createConfiguredDataStore({
    rootDir: './tmp/configured-datastore',
    areas: {
      users: { type: 'postgres' },
      'user-environments': { type: 'postgres' },
      reports: { type: 'file' },
    },
    databaseConfig: {
      host: 'db.unit.test',
      port: 5432,
      database: 'app',
      user: 'app_user',
      password: 'synthetic-password',
    },
    poolFactory: (options) => {
      poolCreations += 1;
      poolOptions.push(options);
      return pool;
    },
  });

  try {
    await store.initialize();
    assert.equal(calls.filter(({ text }) => text.startsWith('CREATE TABLE')).length, 2);
    assert.match(calls[0].text, /"users"/);
    assert.match(calls[1].text, /"user_environments"/);
    assert.deepEqual(await store.read('users', 'user-1'), { id: 'user-1' });
    assert.deepEqual(await store.list('users'), ['alpha', 'beta']);
    const user = { id: 'user-1', username: 'demo' };
    assert.equal(await store.write('users', 'user-1', user), user);
    const writeCall = calls.at(-1);
    assert.match(writeCall.text, /ON CONFLICT \(id\) DO UPDATE/);
    assert.deepEqual(writeCall.values, ['user-1', JSON.stringify(user)]);
    assert.equal(await store.delete('users', 'user-1'), true);
    assert.equal(await store.delete('users', 'missing'), false);

    await store.write('reports', 'daily', { count: 3 });
    assert.deepEqual(await store.read('reports', 'daily'), { count: 3 });
    assert.deepEqual(await store.list('reports'), ['daily']);
  } finally {
    await store.close();
  }
  assert.equal(closedPools.length, 1);
  assert.equal(poolCreations, 1);
  assert.deepEqual(poolOptions, [{
    host: 'db.unit.test',
    port: 5432,
    database: 'app',
    user: 'app_user',
    password: 'synthetic-password',
    allowExitOnIdle: true,
  }]);
});

test('SQL schema declares a record table for each standard datastore area', () => {
  const schema = readFileSync(new URL('../sql/schema.sql', import.meta.url), 'utf8');
  for (const table of [
    'organizations',
    'groups',
    'users',
    'stores',
    'user_environments',
    'acls',
    'virtual_machines',
  ]) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(`));
  }
  assert.equal((schema.match(/data JSONB NOT NULL/g) || []).length, 7);
});

test('default runtime configs use PostgreSQL only for identity and ACL datastores', () => {
  for (const configFile of ['../config/app.env.json', '../config/app.config.json']) {
    const config = JSON.parse(readFileSync(new URL(configFile, import.meta.url), 'utf8'));
    const postgresAreas = Object.entries(config.datastores)
      .filter(([, datastore]) => datastore.type === 'postgres')
      .map(([area]) => area)
      .sort();
    assert.deepEqual(postgresAreas, [
      'acls',
      'groups',
      'organizations',
      'user-environments',
      'users',
    ]);
    assert.equal(config.datastores.stores.type, 'file');
    assert.equal(config.datastores['virtual-machines'].type, 'file');
  }
});

test('datastore routing summary shows PostgreSQL tables and local JSON paths', () => {
  const routes = getDatastoreRoutes({
    users: { type: 'postgres' },
    reports: { type: 'file' },
    audit: { type: 'postgres', table: 'audit_records' },
  });

  assert.deepEqual(routes.find(({ area }) => area === 'users'), {
    area: 'users',
    backend: 'PostgreSQL',
    location: 'Table: users',
  });
  assert.deepEqual(routes.find(({ area }) => area === 'reports'), {
    area: 'reports',
    backend: 'Local files',
    location: 'data/reports/*.json',
  });
  assert.deepEqual(routes.find(({ area }) => area === 'audit'), {
    area: 'audit',
    backend: 'PostgreSQL',
    location: 'Table: audit_records',
  });
  assert.deepEqual(routes.find(({ area }) => area === 'stores'), {
    area: 'stores',
    backend: 'Local files',
    location: 'data/stores/*.json',
  });
});

test('configured datastore rejects missing PostgreSQL settings and unsafe table names', () => {
  assert.throws(
    () => createConfiguredDataStore({
      areas: { users: { type: 'postgres' } },
      poolFactory: () => assert.fail('should not create a pool'),
    }),
    /runtime variables are required/,
  );
  assert.throws(
    () => createConfiguredDataStore({
      areas: {
        users: {
          type: 'postgres',
          table: 'users; DROP TABLE users',
        },
      },
      databaseConfig: {
        host: 'db.unit.test',
        port: 5432,
        database: 'app',
        user: 'app_user',
        password: 'synthetic-password',
      },
      poolFactory: () => assert.fail('should not create a pool'),
    }),
    /Invalid PostgreSQL table name/,
  );
});

test('PostgreSQL config uses required runtime variables without exposing their values in errors', () => {
  const environment = {
    DATABASE_HOST: 'db.example.test',
    DATABASE_PORT: '5433',
    DATABASE_DBNAME: 'hubs',
    DATABASE_USER: 'hubs_app',
    DATABASE_PASSWORD: 'synthetic-password',
  };
  assert.deepEqual(getPostgresConfigFromEnvironment(environment), {
    host: 'db.example.test',
    port: 5433,
    database: 'hubs',
    user: 'hubs_app',
    password: 'synthetic-password',
  });
  assert.throws(
    () => getPostgresConfigFromEnvironment({ ...environment, DATABASE_PORT: 'not-a-port' }),
    /DATABASE_PORT must be an integer/,
  );
  assert.throws(
    () => getPostgresConfigFromEnvironment({ ...environment, DATABASE_PASSWORD: '' }),
    (error) => {
      assert.match(error.message, /DATABASE_PASSWORD/);
      assert.equal(error.message.includes('synthetic-password'), false);
      return true;
    },
  );
});

test('application runtime bootstraps configured PostgreSQL areas and keeps other areas local', async () => {
  const rootDir = resolve('./tmp/configured-runtime');
  mkdirSync(resolve(rootDir, 'config'), { recursive: true });
  writeFileSync(resolve(rootDir, 'config/app.env.json'), JSON.stringify({
    datastores: {
      users: { type: 'postgres' },
    },
    users: [{ id: 'postgres-user', username: 'postgres-user' }],
    organizations: [{ id: 'local-org', name: 'Local organization' }],
  }));
  const records = new Map();
  const statements = [];
  const pool = {
    async query(text, values = []) {
      statements.push(text);
      if (text.startsWith('INSERT INTO')) {
        const [id, rawData] = values;
        records.set(id, JSON.parse(rawData));
        return { rowCount: 1, rows: [] };
      }
      if (text.startsWith('SELECT data')) {
        const data = records.get(values[0]);
        return { rows: data === undefined ? [] : [{ data }] };
      }
      if (text.startsWith('SELECT id')) {
        return { rows: [...records.keys()].map((id) => ({ id })) };
      }
      return { rowCount: 0, rows: [] };
    },
    async end() {},
  };
  const databaseEnvironment = {
    DATABASE_HOST: 'db.unit.test',
    DATABASE_PORT: '5432',
    DATABASE_DBNAME: 'app',
    DATABASE_USER: 'app_user',
    DATABASE_PASSWORD: 'synthetic-password',
  };
  const previousEnvironment = Object.fromEntries(
    Object.keys(databaseEnvironment).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, databaseEnvironment);
  let runtime;
  try {
    runtime = await createApplicationRuntime({
      rootDir,
      poolFactory: () => pool,
    });
    assert.deepEqual(await runtime.datastore.read('users', 'postgres-user'), {
      id: 'postgres-user',
      username: 'postgres-user',
    });
    assert.deepEqual(await runtime.datastore.read('organizations', 'local-org'), {
      id: 'local-org',
      name: 'Local organization',
    });
    assert.equal(runtime.datastore.description, 'Area-routed JSON and PostgreSQL datastores');
    assert.ok(statements.some((statement) => statement.includes('CREATE TABLE IF NOT EXISTS "users"')));
    assert.equal(
      statements.some((statement) => statement.includes('CREATE TABLE IF NOT EXISTS "organizations"')),
      false,
    );
  } finally {
    if (runtime) {
      await runtime.datastore.close();
    }
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});
