import { pathToFileURL } from 'node:url';
import { HubRegistry, McpHub, buildHubSummary, createDefaultRegistry } from './hub-engine.js';
import { UniversalConnectionManager } from './data-connection-manager.js';
import {
  ConfiguredDataStore,
  createConfiguredDataStore,
  getPostgresConfigFromEnvironment,
} from './configured-data-store.js';
import { LocalDataStore, PluginLoader } from './local-data-store.js';
import { AppLogger, createDefaultLogger } from './logger.js';
import { AccessControlPlugin, registerAccessControl } from './access-control.js';
import { SecretsManagerPlugin, registerSecretsManager } from './secrets-manager.js';
import { ConfigLoader, bootstrapEnvironmentData } from './config-loader.js';
import { createApplicationRuntime } from './app-runtime.js';

export {
  HubRegistry,
  McpHub,
  buildHubSummary,
  createDefaultRegistry,
  UniversalConnectionManager,
  ConfiguredDataStore,
  createConfiguredDataStore,
  getPostgresConfigFromEnvironment,
  LocalDataStore,
  PluginLoader,
  AppLogger,
  createDefaultLogger,
  AccessControlPlugin,
  registerAccessControl,
  SecretsManagerPlugin,
  registerSecretsManager,
  createApplicationRuntime,
};

function isMainModule() {
  if (!process.argv[1]) {
    return false;
  }

  return import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  const runtime = await createApplicationRuntime();
  console.log(JSON.stringify(runtime.summary, null, 2));
}
