import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HubRegistry, McpHub, buildHubSummary, createDefaultRegistry } from './hub-engine.js';
import { PluginLoader } from './local-data-store.js';
import { createConfiguredDataStore, getPostgresConfigFromEnvironment } from './configured-data-store.js';
import { createDefaultLogger } from './logger.js';
import { ConfigLoader, bootstrapEnvironmentData } from './config-loader.js';

const DEFAULT_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

export async function createApplicationRuntime({
  rootDir = DEFAULT_ROOT,
  poolFactory,
  databaseConfig,
} = {}) {
  const registry = createDefaultRegistry();
  const summary = {
    status: registry.status(),
    hubs: buildHubSummary(registry.list()),
  };
  const logger = createDefaultLogger({ logDir: resolve(rootDir, 'logs') });
  const configPath = resolve(rootDir, 'config/app.env.json');
  let startupConfig;

  try {
    startupConfig = await new ConfigLoader(configPath).load();
  } catch (error) {
    if (error.code !== 'ENOENT' && !error.message.includes('not found')) {
      throw error;
    }
    const fallbackPath = resolve(rootDir, 'config/app.config.json');
    startupConfig = await new ConfigLoader(fallbackPath).load();
  }

  const datastoreAreas = startupConfig.datastores || {};
  const usesPostgres = Object.values(datastoreAreas)
    .some((config) => String(config?.type || 'file').toLowerCase() === 'postgres');
  const postgresConfig = usesPostgres
    ? databaseConfig || getPostgresConfigFromEnvironment()
    : undefined;
  const datastore = createConfiguredDataStore({
    rootDir: resolve(rootDir, 'data'),
    areas: datastoreAreas,
    databaseConfig: postgresConfig,
    poolFactory,
  });
  await datastore.initialize();
  await bootstrapEnvironmentData(datastore, startupConfig);

  const pluginLoader = new PluginLoader({
    pluginDirectories: [resolve(rootDir, 'plugins')],
    appContext: {
      datastore,
      logger,
      secretsConfig: {
        stores: startupConfig.stores || {},
      },
    },
  });
  const plugins = await pluginLoader.loadAll();
  const vmPlugin = plugins.find((plugin) => plugin.name === 'vm-orchestrator');
  const accessPlugin = plugins.find((plugin) => plugin.name === 'access-control');
  const secretsPlugin = plugins.find((plugin) => plugin.name === 'secrets-manager');

  if (vmPlugin) {
    const vms = await vmPlugin.plugin.listVirtualMachines();
    summary.infrastructure = {
      vmDefinitions: vms.map(({ id, name, provider, state }) => ({ id, name, provider, state })),
      loadedPlugins: plugins.map(({ name }) => name),
    };
  }

  if (accessPlugin) {
    summary.accessControl = { enabled: true, pluginName: accessPlugin.name };
  }

  if (secretsPlugin) {
    summary.secrets = {
      enabled: true,
      pluginName: secretsPlugin.name,
      configuredStores: await secretsPlugin.plugin.listConfiguredStores(),
    };
  }

  return {
    rootDir,
    configPath,
    startupConfig,
    datastore,
    logger,
    plugins,
    summary,
  };
}

export async function buildDashboardData(runtime) {
  const users = [];
  for (const id of await runtime.datastore.list('users')) {
    const user = await runtime.datastore.read('users', id);
    if (user) {
      users.push({
        id: user.id || id,
        username: user.username || user.id || id,
        email: user.email || '',
        organizationId: user.organizationId || '',
        groupIds: Array.isArray(user.groupIds) ? user.groupIds : [],
        roles: Array.isArray(user.roles) ? user.roles : [],
      });
    }
  }

  const stores = Object.entries(runtime.startupConfig.stores || {}).map(([id, store]) => ({
    id,
    name: store.name || id,
    type: store.type || 'Unknown',
    endpoint: store.address || store.endpoint || [store.host, store.port].filter(Boolean).join(':'),
    status: 'Configured',
    kvEngine: store.kv?.engine || '',
    mount: store.kv?.mount || '',
  }));

  return {
    application: {
      name: 'MCP Uni Hubs',
      configFile: runtime.configPath.slice(runtime.rootDir.length + 1),
      datastore: runtime.datastore.description || 'Local JSON datastore',
      logLevel: runtime.logger.level,
      instanceId: runtime.logger.instanceId,
    },
    plugins: runtime.plugins.map(({ name }) => ({ name, status: 'Loaded' })),
    stores,
    users,
    hubStatus: runtime.summary.status,
  };
}
