const SECRETS_BACKENDS = {
  CYBERVAULT: {
    fetch: async ({ path, token, endpoint }) => ({ key: path, value: 'vault-db-password', endpoint, token, type: 'CyberVault' }),
  },
  INFISICAL: {
    fetch: async ({ path, token, endpoint }) => ({ key: path, value: 'infisical-token', endpoint, token, type: 'Infisical' }),
  },
  OPENBAO: {
    fetch: async ({ path, token, endpoint }) => ({ key: path, value: 'openbao-token', endpoint, token, type: 'OpenBAO' }),
  },
  IDIRA: {
    fetch: async ({ path, token, endpoint }) => ({ key: path, value: 'idira-token', endpoint, token, type: 'Idira' }),
  },
  ZEROSOPS: {
    fetch: async ({ path, token, endpoint }) => ({ key: path, value: 'zerosops-token', endpoint, token, type: 'ZeroSOPS' }),
  },
  AWSSM: {
    fetch: async ({ path, token, endpoint }) => ({ key: path, value: 'aws-sm-token', endpoint, token, type: 'AWSSM' }),
  },
  AZUREKEYVAULT: {
    fetch: async ({ path, token, endpoint }) => ({ key: path, value: 'azure-key-token', endpoint, token, type: 'AzureKeyVault' }),
  },
  SECRETARIO: {
    fetch: async ({ path, key, token, endpoint, headers = {}, kv = {} }) => {
      const sanitizedPath = String(path || '').replace(/^\/+/, '').replace(/\/+$/, '');
      const baseAddress = String(endpoint || '').replace(/\/+$/, '');
      const uriTemplate = kv.dataPath || `${baseAddress}/v1/${kv.mount || 'secret'}/data/${sanitizedPath}`;
      const fetchUrl = uriTemplate.includes('<path>')
        ? (uriTemplate.startsWith('/')
            ? `${baseAddress}${uriTemplate.replace('<path>', sanitizedPath)}`
            : uriTemplate.replace('<path>', sanitizedPath))
        : `${baseAddress}/v1/${kv.mount || 'secret'}/data/${sanitizedPath}`;
      const requestHeaders = {
        ...(headers || {}),
        ...(token ? { 'X-Vault-Token': token } : {}),
        'Content-Type': 'application/json',
      };

      const response = await fetch(fetchUrl, {
        method: 'GET',
        headers: requestHeaders,
      });

      if (!response || !response.ok) {
        throw new Error(`Failed to fetch secret ${path} from Secretario Vault`);
      }

      const payload = await response.json();
      const secretData = payload?.data?.data || payload?.data || {};
      const secretValue = key ? secretData[key] : Object.values(secretData)[0];

      if (secretValue === undefined) {
        throw new Error(`Key ${key || '<unknown>'} not found in Vault response for ${path}`);
      }

      return {
        key: key || path,
        value: secretValue,
        endpoint: baseAddress,
        token,
        type: 'Secretario',
      };
    },
  },
};

export class SecretsManagerPlugin {
  constructor({ datastore, config = {}, logger = null } = {}) {
    this.datastore = datastore;
    this.config = config;
    this.logger = logger;
    this.stores = config.stores || {};
  }

  async loadEnvironment(userId, environmentName) {
    if (!this.datastore) {
      return null;
    }

    const envId = `${userId}-${environmentName}`;
    const env = await this.datastore.read('user-environments', envId);
    if (!env) {
      throw new Error(`No environment configured for user ${userId} in ${environmentName}`);
    }

    return {
      ...env,
      id: env.id || envId,
      userId,
      name: environmentName,
      secretRefs: Array.isArray(env.secretRefs) ? env.secretRefs : [],
    };
  }

  async resolveUserEnvironment(userId, environmentName) {
    const environment = await this.loadEnvironment(userId, environmentName);
    const resolved = {};

    for (const ref of environment.secretRefs || []) {
      const storeConfig = this.stores[ref.store] || {};
      const type = String(storeConfig.type || ref.store || 'secretario').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const backend = SECRETS_BACKENDS[type] || SECRETS_BACKENDS.SECRETARIO;
      const result = await backend.fetch({
        path: ref.path,
        key: ref.key,
        token: storeConfig.token || ref.token || (storeConfig.headers && storeConfig.headers['X-Vault-Token']) || null,
        endpoint: storeConfig.address || storeConfig.endpoint || storeConfig.host || null,
        headers: storeConfig.headers || {},
        kv: storeConfig.kv || {},
        ...ref,
        ...storeConfig,
      });

      resolved[ref.key] = result.value;
    }

    return resolved;
  }

  async listConfiguredStores() {
    return Object.keys(this.stores || {});
  }

  async getStoreConfig(name) {
    return this.stores[name] || null;
  }
}

export function registerSecretsManager(appContext = {}) {
  return new SecretsManagerPlugin({
    datastore: appContext.datastore,
    config: appContext.secretsConfig || {},
    logger: appContext.logger,
  });
}
