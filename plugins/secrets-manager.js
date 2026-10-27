import { registerSecretsManager } from '../src/secrets-manager.js';

export default function secretsManagerPluginFactory(appContext = {}) {
  return registerSecretsManager(appContext);
}
