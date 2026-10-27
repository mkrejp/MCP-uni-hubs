import test from 'node:test';
import assert from 'node:assert/strict';

import { HubRegistry, McpHub, buildHubSummary, createDefaultRegistry } from '../src/hub-engine.js';
import { UniversalConnectionManager } from '../src/data-connection-manager.js';
import { LocalDataStore, PluginLoader } from '../src/local-data-store.js';
import { AppLogger } from '../src/logger.js';
import { AccessControlPlugin } from '../src/access-control.js';
import { SecretsManagerPlugin } from '../src/secrets-manager.js';
import { ConfigLoader, bootstrapEnvironmentData } from '../src/config-loader.js';
import { createDashboardServer } from '../src/web-server.js';
import { COOKIE_NAMES, createSessionToken } from '../src/google-auth.js';

test('registry registers and resolves hubs', () => {
  const registry = new HubRegistry();
  const hub = new McpHub({ id: 'alpha', name: 'Alpha', transport: 'http' });

  registry.register(hub);

  assert.equal(registry.get('alpha'), hub);
  assert.deepEqual(registry.list().map((item) => item.id), ['alpha']);
});

test('status summarizes health states', () => {
  const registry = new HubRegistry();

  registry.register(new McpHub({ id: 'one', name: 'One', status: 'healthy' }));
  registry.register(new McpHub({ id: 'two', name: 'Two', status: 'degraded' }));
  registry.register(new McpHub({ id: 'three', name: 'Three', status: 'offline' }));

  assert.deepEqual(registry.status(), {
    total: 3,
    healthy: 1,
    degraded: 1,
    offline: 1,
  });
});

test('default registry includes sample hubs and summary output', () => {
  const registry = createDefaultRegistry();

  assert.equal(registry.get('docs-hub')?.name, 'Docs Hub');
  assert.equal(registry.get('runtime-hub')?.transport, 'stdio');
  assert.deepEqual(
    buildHubSummary(registry.list()),
    [
      { id: 'docs-hub', name: 'Docs Hub', transport: 'http', status: 'healthy' },
      { id: 'runtime-hub', name: 'Runtime Hub', transport: 'stdio', status: 'healthy' },
      { id: 'watcher-hub', name: 'Watcher Hub', transport: 'sse', status: 'degraded' },
    ],
  );
});

test('universal connection manager supports sql and local file data areas', async () => {
  const manager = new UniversalConnectionManager();
  const sqlArea = manager.connect('analytics', {
    type: 'sql',
    connectionString: 'postgres://user:pass@localhost/app',
    database: 'analytics',
  });

  const localArea = manager.connect('reports', {
    type: 'file',
    path: './tmp/reports.json',
  });

  assert.equal(sqlArea.type, 'sql');
  assert.equal(sqlArea.database, 'analytics');
  assert.equal(localArea.type, 'file');

  await manager.write('reports', 'daily-overview', { total: 42, status: 'ok' });
  const snapshot = await manager.read('reports', 'daily-overview');
  assert.deepEqual(snapshot, { total: 42, status: 'ok' });

  const sqlResult = await manager.query('analytics', 'SELECT * FROM events WHERE status = ?', ['ok']);
  assert.deepEqual(sqlResult, [{ status: 'ok' }]);
});

test('local datastore persists json files and startup plugin loader loads plugins', async () => {
  const store = new LocalDataStore('./tmp/local-data-store');

  await store.write('users', 'demo-user', { id: 'demo-user', email: 'demo@example.com' });
  const persisted = await store.read('users', 'demo-user');
  assert.deepEqual(persisted, { id: 'demo-user', email: 'demo@example.com' });

  const loader = new PluginLoader({
    pluginDirectories: ['./plugins'],
    appContext: { datastore: store },
  });

  const loaded = await loader.loadAll();
  assert.ok(loaded.some((plugin) => plugin.name === 'sample-plugin'));
});

test('app logger is controlled by config level and writes per-day instance logs', async () => {
  const logger = new AppLogger({
    level: 'INFO',
    logDir: './tmp/logs',
    instanceId: 'instance-42',
  });

  logger.info('startup complete');
  logger.debug('hidden debug message');
  logger.warn('watch this');
  logger.error('failure encountered');

  const currentDay = new Date().toISOString().slice(0, 10);
  const logFile = `${logger.logDir}/app-${currentDay}-instance-42.log`;

  assert.equal(logger.level, 'INFO');
  assert.equal(logger.levelValue, 20);
  assert.ok(logger.filePath.endsWith(`${currentDay}-instance-42.log`));
  assert.equal(logger.shouldLog('DEBUG'), false);
  assert.equal(logger.shouldLog('INFO'), true);
  assert.ok(logger.fileExists(logFile));
});

test('vm orchestrator plugin reads datastore definitions and dispatches provider actions', async () => {
  const store = new LocalDataStore('./tmp/vm-data');
  const vmDefinition = {
    id: 'vm-aws-01',
    name: 'web-01',
    provider: 'AWS',
    apiType: 'ec2.create_instances',
    connection: {
      region: 'us-east-1',
      accessKeyId: 'demo-key',
      secretAccessKey: 'demo-secret',
      endpoint: 'https://ec2.us-east-1.amazonaws.com',
    },
    spec: {
      instanceType: 't3.micro',
      imageId: 'ami-123456',
    },
    state: 'stopped',
  };

  await store.write('virtual-machines', 'vm-aws-01', vmDefinition);

  const loader = new PluginLoader({
    pluginDirectories: ['./plugins'],
    appContext: { datastore: store },
  });

  const loaded = await loader.loadAll();
  const orchestrator = loaded.find((plugin) => plugin.name === 'vm-orchestrator');

  assert.ok(orchestrator, 'VM orchestrator plugin should be loaded');
  assert.equal((await orchestrator.plugin.listVirtualMachines()).length, 1);

  const createResult = await orchestrator.plugin.createVm('vm-aws-01');
  assert.equal(createResult.status, 'created');
  assert.equal(createResult.provider, 'AWS');

  const startResult = await orchestrator.plugin.startVm('vm-aws-01');
  assert.equal(startResult.status, 'running');

  const stopResult = await orchestrator.plugin.stopVm('vm-aws-01');
  assert.equal(stopResult.status, 'stopped');

  const deleteResult = await orchestrator.plugin.deleteVm('vm-aws-01');
  assert.equal(deleteResult.status, 'deleted');
});

test('access control plugin grants or denies plugin and function access by org, group, and acl', async () => {
  const datastore = new LocalDataStore('./tmp/access-control');
  const accessPlugin = new AccessControlPlugin({ datastore });

  await datastore.write('organizations', 'org-1', { id: 'org-1', name: 'Acme Corp' });
  await datastore.write('groups', 'ops-group', { id: 'ops-group', name: 'Operations', organizationId: 'org-1' });
  await datastore.write('users', 'user-1', {
    id: 'user-1',
    username: 'ops-admin',
    organizationId: 'org-1',
    groupIds: ['ops-group'],
  });

  await datastore.write('acls', 'vm-orchestrator-create', {
    id: 'vm-orchestrator-create',
    subjectType: 'group',
    subjectId: 'ops-group',
    resourceType: 'plugin',
    resourceId: 'vm-orchestrator',
    action: 'createVm',
    effect: 'allow',
    organizationId: 'org-1',
  });

  const allow = await accessPlugin.canAccess('user-1', 'vm-orchestrator', 'createVm');
  const deny = await accessPlugin.canAccess('user-1', 'vm-orchestrator', 'deleteVm');

  assert.equal(allow, true);
  assert.equal(deny, false);

  const user = await accessPlugin.getUser('user-1');
  assert.equal(user.organizationId, 'org-1');
  assert.equal((await accessPlugin.listGroupsForUser('user-1')).length, 1);
});

test('secrets manager plugin resolves user environment secrets from configured remote stores', async () => {
  const datastore = new LocalDataStore('./tmp/secrets-manager');
  const plugin = new SecretsManagerPlugin({
    datastore,
    config: {
      stores: {
        cybervault: { type: 'CyberVault', endpoint: 'https://vault.example.com', token: 'unit-cybervault-token' },
        infisical: { type: 'Infisical', endpoint: 'https://infisical.example.com', token: 'unit-infisical-token' },
      },
    },
  });

  await datastore.write('user-environments', 'user-1-dev', {
    id: 'user-1-dev',
    userId: 'user-1',
    name: 'dev',
    organizationId: 'org-1',
    secretRefs: [
      { key: 'DB_PASSWORD', store: 'cybervault', path: '/prod/db/password' },
      { key: 'API_TOKEN', store: 'infisical', path: '/user-1/dev/api-token' },
    ],
  });

  const values = await plugin.resolveUserEnvironment('user-1', 'dev');
  assert.deepEqual(values, {
    DB_PASSWORD: 'vault-db-password',
    API_TOKEN: 'infisical-token',
  });

  const env = await plugin.loadEnvironment('user-1', 'dev');
  assert.equal(env.userId, 'user-1');
  assert.equal(env.name, 'dev');
  assert.equal(env.secretRefs.length, 2);
});

test('secrets manager plugin can connect to the Secretario Vault service using the real endpoint config', async () => {
  const datastore = new LocalDataStore('./tmp/secrets-manager-real');
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    const headers = options.headers || {};
    assert.equal(url, 'http://secretario.railway.internal:8200/v1/secret/data/app/demo');
    assert.equal(headers['X-Vault-Token'], 'unit-test-token');

    return {
      ok: true,
      async json() {
        return {
          data: {
            data: {
              DB_PASSWORD: 'actual-secret-from-secretario',
            },
          },
        };
      },
    };
  };

  try {
    const plugin = new SecretsManagerPlugin({
      datastore,
      config: {
        stores: {
          secretario: {
            name: 'secretario',
            host: 'secretario.railway.internal',
            port: 8200,
            protocol: 'http',
            address: 'http://secretario.railway.internal:8200',
            token: 'unit-test-token',
            headers: { 'X-Vault-Token': 'unit-test-token' },
            kv: {
              engine: 'kv-v2',
              mount: 'secret',
              dataPath: '/v1/secret/data/<path>',
            },
            healthCheck: 'http://secretario.railway.internal:8200/v1/sys/health',
            type: 'Secretario',
          },
        },
      },
    });

    await datastore.write('user-environments', 'user-2-dev', {
      id: 'user-2-dev',
      userId: 'user-2',
      name: 'dev',
      organizationId: 'org-1',
      secretRefs: [{ key: 'DB_PASSWORD', store: 'secretario', path: 'app/demo' }],
    });

    const values = await plugin.resolveUserEnvironment('user-2', 'dev');
    assert.deepEqual(values, { DB_PASSWORD: 'actual-secret-from-secretario' });
  } finally {
    global.fetch = originalFetch;
  }
});

test('config loader reads single env file and bootstraps testmaster environment', async () => {
  const datastore = new LocalDataStore('./tmp/env-bootstrap');
  const loader = new ConfigLoader('./config/app.env.json');
  const config = await loader.load();

  await bootstrapEnvironmentData(datastore, config);

  const org = await datastore.read('organizations', 'org-platform');
  const group = await datastore.read('groups', 'platform-admins');
  const user = await datastore.read('users', 'testmaster');
  const env = await datastore.read('user-environments', 'testmaster-dev');
  const acl = await datastore.read('acls', 'testmaster-secrets-manager');
  const monitorer = await datastore.read('users', 'monitorer');
  const monitorerEnv = await datastore.read('user-environments', 'monitorer-dev');
  const monitorerAcl = await datastore.read('acls', 'monitorer-read-only');
  const accessControl = new AccessControlPlugin({ datastore });

  assert.equal(org.name, 'Platform Organization');
  assert.equal(group.organizationId, 'org-platform');
  assert.equal(user.username, 'testmaster');
  assert.equal(user.groupIds[0], 'platform-admins');
  assert.equal(env.name, 'dev');
  assert.equal(env.secretRefs[0].store, 'secretario');
  assert.equal(acl.resourceId, 'secrets-manager');
  assert.equal(monitorer.username, 'monitorer');
  assert.equal(monitorer.groupIds.includes('platform-admins'), false);
  assert.equal(monitorerEnv.secretRefs[0].store, 'secretario');
  assert.equal(monitorerAcl.action, 'read');
  assert.equal(await accessControl.canAccess('monitorer', 'vm-orchestrator', 'read', 'plugin'), true);
  assert.equal(await accessControl.canAccess('monitorer', 'vm-orchestrator', 'deleteVm', 'plugin'), false);
  assert.equal(await accessControl.canAccess('monitorer', 'users', 'read', 'data-area'), true);
});

test('config loader resolves store tokens from env and does not persist credentials', async () => {
  const previousToken = process.env.SECRETARIO_TOKEN;
  process.env.SECRETARIO_TOKEN = 'test-only-secret';

  try {
    const config = await new ConfigLoader('./config/app.env.json').load();
    const datastore = new LocalDataStore('./tmp/config-redaction');
    await bootstrapEnvironmentData(datastore, config);
    const storedStore = await datastore.read('stores', 'secretario');

    assert.equal(config.stores.secretario.token, 'test-only-secret');
    assert.equal(storedStore.token, undefined);
    assert.equal(storedStore.headers, undefined);
  } finally {
    if (previousToken === undefined) {
      delete process.env.SECRETARIO_TOKEN;
    } else {
      process.env.SECRETARIO_TOKEN = previousToken;
    }
  }
});

test('web dashboard serves runtime data without exposing store credentials', async () => {
  const previousSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'dashboard-test-session-secret';

  try {
    const datastore = new LocalDataStore('./tmp/dashboard');
    await datastore.write('users', 'monitorer', {
      id: 'monitorer',
      username: 'monitorer',
      email: 'monitorer@example.com',
      organizationId: 'org-platform',
      groupIds: ['platform-readers'],
      roles: ['reader'],
      password: 'must-not-be-returned',
    });

    const runtime = {
      rootDir: '/app',
      configPath: '/app/config/app.env.json',
      startupConfig: {
        stores: {
          secretario: {
            name: 'secretario',
            type: 'Secretario',
            address: 'http://vault.internal:8200',
            token: 'must-not-be-returned',
          },
        },
      },
      datastore,
      logger: { level: 'INFO', instanceId: 'test-instance' },
      plugins: [{ name: 'secrets-manager' }],
      summary: { status: { healthy: 2, total: 3 } },
    };
    const server = createDashboardServer(runtime);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

    try {
      const baseUrl = `http://127.0.0.1:${server.address().port}`;
      const sessionToken = createSessionToken({
        userId: 'monitorer',
        email: 'monitorer@example.com',
      }, process.env.SESSION_SECRET);
      const cookie = `${COOKIE_NAMES.SESSION_COOKIE}=${sessionToken}`;
      const loginPage = await fetch(baseUrl);
      const loginHtml = await loginPage.text();
      const unauthorized = await fetch(`${baseUrl}/api/dashboard`);
      const dashboardPage = await fetch(baseUrl, { headers: { Cookie: cookie } });
      const dashboardHtml = await dashboardPage.text();
      const apiResponse = await fetch(`${baseUrl}/api/dashboard`, {
        headers: { Cookie: cookie },
      });
      const dashboard = await apiResponse.json();
      const serialized = JSON.stringify(dashboard);

      assert.equal(loginPage.status, 200);
      assert.match(loginHtml, /Sign in with Google/i);
      assert.equal(loginHtml.includes('Application overview'), false);
      assert.equal(unauthorized.status, 401);
      assert.equal(dashboardPage.status, 200);
      assert.match(dashboardHtml, /Application overview/);
      assert.equal(apiResponse.status, 200);
      assert.equal(dashboard.plugins[0].name, 'secrets-manager');
      assert.equal(dashboard.stores[0].id, 'secretario');
      assert.equal(dashboard.users[0].username, 'monitorer');
      assert.equal(serialized.includes('must-not-be-returned'), false);
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  } finally {
    if (previousSecret === undefined) {
      delete process.env.SESSION_SECRET;
    } else {
      process.env.SESSION_SECRET = previousSecret;
    }
  }
});
