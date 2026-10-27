import { LocalDataStore } from '../src/local-data-store.js';

const VM_DEFINITION_AREA = 'virtual-machines';
const SUPPORTED_PROTOCOLS = {
  AWS: {
    create: (definition, request) => ({
      provider: 'AWS',
      action: 'create',
      status: 'created',
      request,
      endpoint: definition.connection?.endpoint || 'https://ec2.amazonaws.com',
      apiType: definition.apiType || 'ec2.create_instances',
    }),
    start: (definition, request) => ({
      provider: 'AWS',
      action: 'start',
      status: 'running',
      request,
      endpoint: definition.connection?.endpoint || 'https://ec2.amazonaws.com',
      apiType: definition.apiType || 'ec2.start_instances',
    }),
    stop: (definition, request) => ({
      provider: 'AWS',
      action: 'stop',
      status: 'stopped',
      request,
      endpoint: definition.connection?.endpoint || 'https://ec2.amazonaws.com',
      apiType: definition.apiType || 'ec2.stop_instances',
    }),
    delete: (definition, request) => ({
      provider: 'AWS',
      action: 'delete',
      status: 'deleted',
      request,
      endpoint: definition.connection?.endpoint || 'https://ec2.amazonaws.com',
      apiType: definition.apiType || 'ec2.terminate_instances',
    }),
  },
  GCP: {
    create: (definition, request) => ({
      provider: 'GCP',
      action: 'create',
      status: 'created',
      request,
      endpoint: definition.connection?.endpoint || 'https://compute.googleapis.com',
      apiType: definition.apiType || 'compute.instances.insert',
    }),
    start: (definition, request) => ({
      provider: 'GCP',
      action: 'start',
      status: 'running',
      request,
      endpoint: definition.connection?.endpoint || 'https://compute.googleapis.com',
      apiType: definition.apiType || 'compute.instances.start',
    }),
    stop: (definition, request) => ({
      provider: 'GCP',
      action: 'stop',
      status: 'stopped',
      request,
      endpoint: definition.connection?.endpoint || 'https://compute.googleapis.com',
      apiType: definition.apiType || 'compute.instances.stop',
    }),
    delete: (definition, request) => ({
      provider: 'GCP',
      action: 'delete',
      status: 'deleted',
      request,
      endpoint: definition.connection?.endpoint || 'https://compute.googleapis.com',
      apiType: definition.apiType || 'compute.instances.delete',
    }),
  },
  AZURE: {
    create: (definition, request) => ({
      provider: 'AZURE',
      action: 'create',
      status: 'created',
      request,
      endpoint: definition.connection?.endpoint || 'https://management.azure.com',
      apiType: definition.apiType || 'virtualMachines.create',
    }),
    start: (definition, request) => ({
      provider: 'AZURE',
      action: 'start',
      status: 'running',
      request,
      endpoint: definition.connection?.endpoint || 'https://management.azure.com',
      apiType: definition.apiType || 'virtualMachines.start',
    }),
    stop: (definition, request) => ({
      provider: 'AZURE',
      action: 'stop',
      status: 'stopped',
      request,
      endpoint: definition.connection?.endpoint || 'https://management.azure.com',
      apiType: definition.apiType || 'virtualMachines.powerOff',
    }),
    delete: (definition, request) => ({
      provider: 'AZURE',
      action: 'delete',
      status: 'deleted',
      request,
      endpoint: definition.connection?.endpoint || 'https://management.azure.com',
      apiType: definition.apiType || 'virtualMachines.delete',
    }),
  },
  VMWARE: {
    create: (definition, request) => ({
      provider: 'VMWARE',
      action: 'create',
      status: 'created',
      request,
      endpoint: definition.connection?.endpoint || 'https://vcenter.local/sdk',
      apiType: definition.apiType || 'vm.create',
    }),
    start: (definition, request) => ({
      provider: 'VMWARE',
      action: 'start',
      status: 'running',
      request,
      endpoint: definition.connection?.endpoint || 'https://vcenter.local/sdk',
      apiType: definition.apiType || 'vm.powerOn',
    }),
    stop: (definition, request) => ({
      provider: 'VMWARE',
      action: 'stop',
      status: 'stopped',
      request,
      endpoint: definition.connection?.endpoint || 'https://vcenter.local/sdk',
      apiType: definition.apiType || 'vm.powerOff',
    }),
    delete: (definition, request) => ({
      provider: 'VMWARE',
      action: 'delete',
      status: 'deleted',
      request,
      endpoint: definition.connection?.endpoint || 'https://vcenter.local/sdk',
      apiType: definition.apiType || 'vm.destroy',
    }),
  },
  'IBM-VPC': {
    create: (definition, request) => ({
      provider: 'IBM-VPC',
      action: 'create',
      status: 'created',
      request,
      endpoint: definition.connection?.endpoint || 'https://us-south.iaas.cloud.ibm.com',
      apiType: definition.apiType || 'instance.create',
    }),
    start: (definition, request) => ({
      provider: 'IBM-VPC',
      action: 'start',
      status: 'running',
      request,
      endpoint: definition.connection?.endpoint || 'https://us-south.iaas.cloud.ibm.com',
      apiType: definition.apiType || 'instance.start',
    }),
    stop: (definition, request) => ({
      provider: 'IBM-VPC',
      action: 'stop',
      status: 'stopped',
      request,
      endpoint: definition.connection?.endpoint || 'https://us-south.iaas.cloud.ibm.com',
      apiType: definition.apiType || 'instance.stop',
    }),
    delete: (definition, request) => ({
      provider: 'IBM-VPC',
      action: 'delete',
      status: 'deleted',
      request,
      endpoint: definition.connection?.endpoint || 'https://us-south.iaas.cloud.ibm.com',
      apiType: definition.apiType || 'instance.delete',
    }),
  },
  'IBM-POWERVC': {
    create: (definition, request) => ({
      provider: 'IBM-POWERVC',
      action: 'create',
      status: 'created',
      request,
      endpoint: definition.connection?.endpoint || 'https://pvm.ibmcloud.com',
      apiType: definition.apiType || 'pvm.create',
    }),
    start: (definition, request) => ({
      provider: 'IBM-POWERVC',
      action: 'start',
      status: 'running',
      request,
      endpoint: definition.connection?.endpoint || 'https://pvm.ibmcloud.com',
      apiType: definition.apiType || 'pvm.start',
    }),
    stop: (definition, request) => ({
      provider: 'IBM-POWERVC',
      action: 'stop',
      status: 'stopped',
      request,
      endpoint: definition.connection?.endpoint || 'https://pvm.ibmcloud.com',
      apiType: definition.apiType || 'pvm.stop',
    }),
    delete: (definition, request) => ({
      provider: 'IBM-POWERVC',
      action: 'delete',
      status: 'deleted',
      request,
      endpoint: definition.connection?.endpoint || 'https://pvm.ibmcloud.com',
      apiType: definition.apiType || 'pvm.delete',
    }),
  },
  OPENSTACK: {
    create: (definition, request) => ({
      provider: 'OPENSTACK',
      action: 'create',
      status: 'created',
      request,
      endpoint: definition.connection?.endpoint || 'https://openstack.example.com',
      apiType: definition.apiType || 'servers.create',
    }),
    start: (definition, request) => ({
      provider: 'OPENSTACK',
      action: 'start',
      status: 'running',
      request,
      endpoint: definition.connection?.endpoint || 'https://openstack.example.com',
      apiType: definition.apiType || 'servers.start',
    }),
    stop: (definition, request) => ({
      provider: 'OPENSTACK',
      action: 'stop',
      status: 'stopped',
      request,
      endpoint: definition.connection?.endpoint || 'https://openstack.example.com',
      apiType: definition.apiType || 'servers.stop',
    }),
    delete: (definition, request) => ({
      provider: 'OPENSTACK',
      action: 'delete',
      status: 'deleted',
      request,
      endpoint: definition.connection?.endpoint || 'https://openstack.example.com',
      apiType: definition.apiType || 'servers.delete',
    }),
  },
};

function normalizeProvider(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return 'UNKNOWN';
  }

  const direct = Object.keys(SUPPORTED_PROTOCOLS).find((key) => key.toUpperCase() === normalized.toUpperCase());
  if (direct) {
    return direct;
  }

  const mapValue = normalized.toUpperCase().replace(/[^A-Z0-9]+/g, '-');
  return Object.keys(SUPPORTED_PROTOCOLS).find((key) => key.toUpperCase().replace(/[^A-Z0-9]+/g, '-') === mapValue) || normalized.toUpperCase();
}

export default function registerVmOrchestrator(appContext = {}) {
  const datastore = appContext.datastore || new LocalDataStore('./data');
  const logger = appContext.logger || null;

  async function listVirtualMachines() {
    const entries = await datastore.list(VM_DEFINITION_AREA);
    const definitions = [];

    for (const entry of entries) {
      const definition = await datastore.read(VM_DEFINITION_AREA, entry);
      if (definition) {
        definitions.push(definition);
      }
    }

    return definitions;
  }

  async function getVmDefinition(vmId) {
    const definitions = await listVirtualMachines();
    const match = definitions.find((definition) => definition.id === vmId || definition.name === vmId);
    if (!match) {
      throw new Error(`VM definition not found: ${vmId}`);
    }
    return match;
  }

  function buildRequest(definition, action, overrides = {}) {
    return {
      id: definition.id,
      name: definition.name,
      provider: definition.provider || definition.protocol || definition.type,
      action,
      connection: { ...(definition.connection || {}), ...(overrides.connection || {}) },
      spec: { ...(definition.spec || {}), ...(overrides.spec || {}) },
      apiType: definition.apiType || definition.type || action,
    };
  }

  async function performAction(vmId, action, overrides = {}) {
    const definition = await getVmDefinition(vmId);
    const providerName = normalizeProvider(definition.provider || definition.protocol || definition.type || 'AWS');
    const handler = SUPPORTED_PROTOCOLS[providerName];

    if (!handler || !handler[action]) {
      throw new Error(`Unsupported VM protocol for ${vmId}: ${providerName}`);
    }

    const request = buildRequest(definition, action, overrides);
    const remoteResponse = handler[action](definition, request);

    if (logger && typeof logger.info === 'function') {
      logger.info(`VM ${action} dispatched`, { vmId, provider: providerName, action });
    }

    const state = action === 'create' ? 'created' : action === 'start' ? 'running' : action === 'stop' ? 'stopped' : 'deleted';
    const persistedDefinition = { ...definition, state, lastAction: action, remoteResponse };

    if (action !== 'delete') {
      await datastore.write(VM_DEFINITION_AREA, definition.id, persistedDefinition);
    } else {
      await datastore.delete(VM_DEFINITION_AREA, definition.id);
    }

    return { ...remoteResponse, id: definition.id, name: definition.name, status: remoteResponse.status || state };
  }

  return {
    name: 'vm-orchestrator',
    type: 'vm-orchestrator',
    listVirtualMachines,
    getVmDefinition,
    createVm: async (vmId, overrides = {}) => performAction(vmId, 'create', overrides),
    startVm: async (vmId, overrides = {}) => performAction(vmId, 'start', overrides),
    stopVm: async (vmId, overrides = {}) => performAction(vmId, 'stop', overrides),
    deleteVm: async (vmId, overrides = {}) => performAction(vmId, 'delete', overrides),
  };
}
