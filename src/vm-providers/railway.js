const DEFAULT_GRAPHQL_ENDPOINT = 'https://backboard.railway.com/graphql/v2';

/**
 * Railway API token from the container runtime only.
 * Preferred: RAILWAY_TOKEN (Railway docs / CLI). Alias: RAILWAY_API_TOKEN.
 * Never read a token from VM definition JSON or the datastore.
 */
export function resolveRailwayToken(env = process.env) {
  const token = env.RAILWAY_TOKEN || env.RAILWAY_API_TOKEN || '';
  return String(token).trim();
}

export function expandPlaceholders(value, env = process.env) {
  if (typeof value === 'string') {
    return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name) => env[name] || '');
  }
  if (Array.isArray(value)) {
    return value.map((item) => expandPlaceholders(item, env));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, expandPlaceholders(item, env)]),
    );
  }
  return value;
}

export function resolveRailwayConnection(definition = {}, request = {}, env = process.env) {
  const merged = expandPlaceholders({
    ...(definition.connection || {}),
    ...(request.connection || {}),
  }, env);

  const remote = definition.remoteResponse || {};
  const endpoint = String(
    merged.endpoint || env.RAILWAY_API_ENDPOINT || DEFAULT_GRAPHQL_ENDPOINT,
  ).replace(/\/+$/, '') || DEFAULT_GRAPHQL_ENDPOINT;

  return {
    endpoint,
    token: resolveRailwayToken(env),
    projectId: String(merged.projectId || env.RAILWAY_PROJECT_ID || '').trim(),
    environmentId: String(merged.environmentId || env.RAILWAY_ENVIRONMENT_ID || '').trim(),
    serviceId: String(
      merged.serviceId
      || remote.serviceId
      || env.RAILWAY_SERVICE_ID
      || '',
    ).trim(),
    projectName: String(merged.projectName || env.RAILWAY_PROJECT_NAME || '').trim(),
  };
}

async function railwayGraphql({ endpoint, token, query, variables = {} }, fetchImpl = fetch) {
  if (!token) {
    throw new Error(
      'Railway API token missing. Set RAILWAY_TOKEN (or RAILWAY_API_TOKEN) on the container runtime.',
    );
  }

  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response || !response.ok) {
    const status = response?.status ?? 'unknown';
    throw new Error(`Railway GraphQL request failed with HTTP ${status}`);
  }

  const payload = await response.json();
  if (payload?.errors?.length) {
    const message = payload.errors.map((error) => error.message || String(error)).join('; ');
    throw new Error(`Railway GraphQL error: ${message}`);
  }

  return payload?.data ?? {};
}

async function findLatestDeployment({ connection, serviceId }, fetchImpl) {
  const data = await railwayGraphql({
    endpoint: connection.endpoint,
    token: connection.token,
    query: `query deployments($input: DeploymentListInput!, $first: Int) {
      deployments(input: $input, first: $first) {
        edges { node { id status createdAt } }
      }
    }`,
    variables: {
      input: {
        projectId: connection.projectId,
        environmentId: connection.environmentId,
        serviceId,
      },
      first: 5,
    },
  }, fetchImpl);

  const nodes = (data.deployments?.edges || []).map((edge) => edge.node).filter(Boolean);
  return nodes[0] || null;
}

function requireIds(connection, { needService = false } = {}) {
  if (!connection.projectId) {
    throw new Error('Railway projectId missing. Set connection.projectId or RAILWAY_PROJECT_ID.');
  }
  if (!connection.environmentId) {
    throw new Error('Railway environmentId missing. Set connection.environmentId or RAILWAY_ENVIRONMENT_ID.');
  }
  if (needService && !connection.serviceId) {
    throw new Error('Railway serviceId missing. Create the VM first or set connection.serviceId / RAILWAY_SERVICE_ID.');
  }
}

function buildBaseResult(action, status, definition, request, connection, extras = {}) {
  return {
    provider: 'RAILWAY',
    action,
    status,
    request,
    endpoint: connection.endpoint,
    apiType: definition.apiType || `railway.${action}`,
    projectId: connection.projectId,
    environmentId: connection.environmentId,
    ...extras,
  };
}

export async function railwayCreate(definition, request, { env = process.env, fetchImpl = fetch } = {}) {
  const connection = resolveRailwayConnection(definition, request, env);
  requireIds(connection);

  const spec = expandPlaceholders({
    ...(definition.spec || {}),
    ...(request.spec || {}),
  }, env);

  const serviceName = String(spec.serviceName || definition.name || definition.id || 'MCP_001').trim();
  const image = String(spec.image || env.RAILWAY_MCP_001_IMAGE || '').trim();
  const repo = String(spec.repo || env.RAILWAY_MCP_001_REPO || '').trim();

  const input = {
    projectId: connection.projectId,
    name: serviceName,
  };

  if (image) {
    input.source = { image };
  } else if (repo) {
    input.source = { repo };
    if (spec.branch) {
      input.branch = String(spec.branch);
    }
  }

  const data = await railwayGraphql({
    endpoint: connection.endpoint,
    token: connection.token,
    query: `mutation serviceCreate($input: ServiceCreateInput!) {
      serviceCreate(input: $input) { id name }
    }`,
    variables: { input },
  }, fetchImpl);

  const service = data.serviceCreate || {};
  const serviceId = service.id;
  if (!serviceId) {
    throw new Error('Railway serviceCreate did not return a service id');
  }

  let deploymentId = null;
  if (spec.deploy !== false && (image || repo)) {
    const deployData = await railwayGraphql({
      endpoint: connection.endpoint,
      token: connection.token,
      query: `mutation serviceInstanceDeployV2($serviceId: String!, $environmentId: String!) {
        serviceInstanceDeployV2(serviceId: $serviceId, environmentId: $environmentId)
      }`,
      variables: {
        serviceId,
        environmentId: connection.environmentId,
      },
    }, fetchImpl);
    deploymentId = deployData.serviceInstanceDeployV2 || null;
  }

  return buildBaseResult('create', 'created', definition, request, connection, {
    serviceId,
    serviceName: service.name || serviceName,
    deploymentId,
  });
}

export async function railwayStart(definition, request, { env = process.env, fetchImpl = fetch } = {}) {
  const connection = resolveRailwayConnection(definition, request, env);
  requireIds(connection, { needService: true });

  const data = await railwayGraphql({
    endpoint: connection.endpoint,
    token: connection.token,
    query: `mutation serviceInstanceDeployV2($serviceId: String!, $environmentId: String!) {
      serviceInstanceDeployV2(serviceId: $serviceId, environmentId: $environmentId)
    }`,
    variables: {
      serviceId: connection.serviceId,
      environmentId: connection.environmentId,
    },
  }, fetchImpl);

  return buildBaseResult('start', 'running', definition, request, connection, {
    serviceId: connection.serviceId,
    deploymentId: data.serviceInstanceDeployV2 || null,
  });
}

export async function railwayStop(definition, request, { env = process.env, fetchImpl = fetch } = {}) {
  const connection = resolveRailwayConnection(definition, request, env);
  requireIds(connection, { needService: true });

  const latest = await findLatestDeployment({
    connection,
    serviceId: connection.serviceId,
  }, fetchImpl);

  if (!latest?.id) {
    throw new Error(`No Railway deployment found to stop for service ${connection.serviceId}`);
  }

  await railwayGraphql({
    endpoint: connection.endpoint,
    token: connection.token,
    query: `mutation deploymentStop($id: String!) {
      deploymentStop(id: $id)
    }`,
    variables: { id: latest.id },
  }, fetchImpl);

  return buildBaseResult('stop', 'stopped', definition, request, connection, {
    serviceId: connection.serviceId,
    deploymentId: latest.id,
    previousDeploymentStatus: latest.status || null,
  });
}

export async function railwayDelete(definition, request, { env = process.env, fetchImpl = fetch } = {}) {
  const connection = resolveRailwayConnection(definition, request, env);
  requireIds(connection, { needService: true });

  await railwayGraphql({
    endpoint: connection.endpoint,
    token: connection.token,
    query: `mutation serviceDelete($id: String!) {
      serviceDelete(id: $id)
    }`,
    variables: { id: connection.serviceId },
  }, fetchImpl);

  return buildBaseResult('delete', 'deleted', definition, request, connection, {
    serviceId: connection.serviceId,
  });
}

export const railwayProtocol = {
  create: railwayCreate,
  start: railwayStart,
  stop: railwayStop,
  delete: railwayDelete,
};
