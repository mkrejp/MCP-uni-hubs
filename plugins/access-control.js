import { registerAccessControl } from '../src/access-control.js';

export default function accessControlPluginFactory(appContext = {}) {
  return registerAccessControl(appContext);
}
