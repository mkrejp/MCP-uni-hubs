import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export class LocalDataStore {
  constructor(rootDir = './data') {
    this.rootDir = resolve(rootDir);
    this.ensureRoot();
  }

  ensureRoot() {
    mkdirSync(this.rootDir, { recursive: true });
  }

  resolveAreaPath(areaName) {
    const areaPath = join(this.rootDir, areaName);
    mkdirSync(areaPath, { recursive: true });
    return areaPath;
  }

  resolveEntryPath(areaName, key) {
    return join(this.resolveAreaPath(areaName), `${key}.json`);
  }

  async read(areaName, key) {
    const entryPath = this.resolveEntryPath(areaName, key);
    if (!existsSync(entryPath)) {
      return null;
    }

    try {
      const raw = readFileSync(entryPath, 'utf8');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async write(areaName, key, value) {
    const entryPath = this.resolveEntryPath(areaName, key);
    const directory = dirname(entryPath);
    mkdirSync(directory, { recursive: true });
    writeFileSync(entryPath, JSON.stringify(value, null, 2), 'utf8');
    return value;
  }

  async list(areaName) {
    const areaPath = this.resolveAreaPath(areaName);
    if (!existsSync(areaPath)) {
      return [];
    }

    return readdirSync(areaPath)
      .filter((item) => item.endsWith('.json'))
      .map((file) => file.replace(/\.json$/, ''));
  }

  async delete(areaName, key) {
    const entryPath = this.resolveEntryPath(areaName, key);
    if (existsSync(entryPath)) {
      writeFileSync(entryPath, '{}', 'utf8');
      return true;
    }
    return false;
  }
}

export class PluginLoader {
  constructor({ pluginDirectories = [], appContext = {} } = {}) {
    this.pluginDirectories = pluginDirectories;
    this.appContext = appContext;
    this.loadedPlugins = [];
  }

  async loadAll() {
    const loaded = [];

    for (const pluginDir of this.pluginDirectories) {
      const directory = resolve(pluginDir);
      if (!existsSync(directory)) {
        continue;
      }

      for (const item of readdirSync(directory)) {
        const entryPath = join(directory, item);
        if (!statSync(entryPath).isFile() || !item.endsWith('.js')) {
          continue;
        }

        const moduleUrl = pathToFileURL(entryPath).href;
        const pluginModule = await import(moduleUrl);
        const plugin = pluginModule.default || pluginModule;

        if (typeof plugin === 'function') {
          loaded.push({
            name: item.replace(/\.js$/, ''),
            file: entryPath,
            plugin: plugin(this.appContext),
          });
        } else if (plugin && typeof plugin.register === 'function') {
          const instance = plugin.register(this.appContext);
          loaded.push({
            name: item.replace(/\.js$/, ''),
            file: entryPath,
            plugin: instance,
          });
        }
      }
    }

    this.loadedPlugins = loaded;
    return this.loadedPlugins;
  }
}
