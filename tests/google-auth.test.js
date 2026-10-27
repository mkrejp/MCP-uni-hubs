import test from 'node:test';
import assert from 'node:assert/strict';

import { LocalDataStore } from '../src/local-data-store.js';
import { createDashboardServer } from '../src/web-server.js';
import {
  COOKIE_NAMES,
  createSessionToken,
  findUserByEmail,
  getGoogleAuthConfig,
  handleGoogleCallback,
  parseCookies,
  verifySessionToken,
} from '../src/google-auth.js';

/**
 * @returns {{datastore: LocalDataStore, runtime: object}}
 */
async function createTestRuntime() {
  const datastore = new LocalDataStore('./tmp/google-auth');
  await datastore.write('users', 'testmaster', {
    id: 'testmaster',
    username: 'testmaster',
    email: 'testmaster@example.com',
    organizationId: 'org-platform',
    groupIds: ['platform-admins'],
    roles: ['admin'],
  });

  return {
    datastore,
    runtime: {
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
    },
  };
}

/**
 * @param {import('node:http').Server} server
 * @returns {Promise<string>}
 */
async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

/**
 * @param {import('node:http').Server} server
 * @returns {Promise<void>}
 */
async function closeServer(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

/**
 * @param {() => Promise<void>} run
 * @returns {Promise<void>}
 */
async function withAuthEnv(run) {
  const previous = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    SESSION_SECRET: process.env.SESSION_SECRET,
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL,
  };

  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.SESSION_SECRET = 'unit-test-session-secret';
  process.env.PUBLIC_BASE_URL = 'https://app.example.com';

  try {
    await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('unauthenticated / serves dedicated login page', async () => {
  await withAuthEnv(async () => {
    const { runtime } = await createTestRuntime();
    const server = createDashboardServer(runtime);
    const baseUrl = await listen(server);

    try {
      const response = await fetch(baseUrl);
      const html = await response.text();
      assert.equal(response.status, 200);
      assert.match(html, /Sign in with Google/i);
      assert.match(html, /href="\/auth\/google"/);
      assert.match(html, /id="overview-heading"/);
      const overview = html.match(/class="overview-copy">([^<]+)<\/p>/)?.[1];
      assert.ok(overview);
      assert.equal((overview.match(/[.!?](?:\s|$)/g) || []).length, 5);
      assert.match(html, /aria-label="Jump to an architecture diagram"/);
      for (const diagramId of ['plugin-heading', 'flow-heading', 'architecture-heading', 'acl-heading', 'network-heading']) {
        assert.match(html, new RegExp(`href="#${diagramId}"`));
        assert.match(html, new RegExp(`id="${diagramId}"`));
      }
      assert.match(html, /Plugin architecture/);
      assert.match(html, /Application flows/);
      assert.match(html, /Solution architecture/);
      assert.match(html, /ACL security architecture/);
      assert.match(html, /Network and connectivity/);
      assert.match(html, /LocalDataStore · data\/\*\.json/);
      assert.match(html, /ConfiguredDataStore/);
      assert.match(html, /PostgreSQL tables/);
      assert.match(html, /DATABASE_HOST · PORT · DBNAME/);
      assert.match(html, /DATABASE_USER · PASSWORD/);
      assert.match(html, /do not currently invoke canAccess\(\)/);
      assert.match(html, /flow-description/);
      assert.match(html, /architecture-description/);
      assert.match(html, /plugin-description/);
      assert.match(html, /acl-description/);
      assert.match(html, /network-description/);
      assert.ok(html.indexOf('Plugin architecture') < html.indexOf('Application flows'));
      assert.ok(html.indexOf('ACL security architecture') > html.indexOf('Solution architecture'));
      assert.ok(html.indexOf('Network and connectivity') > html.indexOf('ACL security architecture'));
      assert.equal(html.includes('Application overview'), false);
      assert.equal(html.includes('/app.js'), false);

      const appJs = await fetch(`${baseUrl}/app.js`);
      const styles = await fetch(`${baseUrl}/styles.css`);
      assert.equal(appJs.status, 401);
      assert.equal(styles.status, 401);
    } finally {
      await closeServer(server);
    }
  });
});

test('unauthenticated /api/dashboard returns 401', async () => {
  await withAuthEnv(async () => {
    const { runtime } = await createTestRuntime();
    const server = createDashboardServer(runtime);
    const baseUrl = await listen(server);

    try {
      const response = await fetch(`${baseUrl}/api/dashboard`);
      assert.equal(response.status, 401);
      const body = await response.json();
      assert.equal(body.error, 'Unauthorized');
    } finally {
      await closeServer(server);
    }
  });
});

test('valid session cookie serves dashboard HTML and /api/dashboard 200', async () => {
  await withAuthEnv(async () => {
    const { runtime } = await createTestRuntime();
    const server = createDashboardServer(runtime);
    const baseUrl = await listen(server);
    const token = createSessionToken({
      userId: 'testmaster',
      email: 'testmaster@example.com',
    }, process.env.SESSION_SECRET);
    const cookie = `${COOKIE_NAMES.SESSION_COOKIE}=${token}`;

    try {
      const page = await fetch(baseUrl, { headers: { Cookie: cookie } });
      const html = await page.text();
      assert.equal(page.status, 200);
      assert.match(html, /Application overview/);
      assert.match(html, /\/app\.js/);
      assert.equal(html.includes('Sign in with Google'), false);

      const appJs = await fetch(`${baseUrl}/app.js`, { headers: { Cookie: cookie } });
      assert.equal(appJs.status, 200);

      const response = await fetch(`${baseUrl}/api/dashboard`, {
        headers: { Cookie: cookie },
      });
      assert.equal(response.status, 200);
      const dashboard = await response.json();
      assert.equal(dashboard.users[0].username, 'testmaster');
      assert.equal(JSON.stringify(dashboard).includes('must-not-be-returned'), false);
    } finally {
      await closeServer(server);
    }
  });
});

test('missing GOOGLE_CLIENT_ID returns 503 on /auth/google', async () => {
  const previousId = process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_ID;

  try {
    const { runtime } = await createTestRuntime();
    const server = createDashboardServer(runtime);
    const baseUrl = await listen(server);

    try {
      const response = await fetch(`${baseUrl}/auth/google`, { redirect: 'manual' });
      assert.equal(response.status, 503);
      const body = await response.json();
      assert.match(body.error, /not configured/i);
      assert.match(body.detail, /GOOGLE_CLIENT_ID/i);
    } finally {
      await closeServer(server);
    }
  } finally {
    if (previousId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = previousId;
    }
  }
});

test('callback rejects bad oauth state', async () => {
  await withAuthEnv(async () => {
    const { runtime } = await createTestRuntime();
    const server = createDashboardServer(runtime);
    const baseUrl = await listen(server);

    try {
      const response = await fetch(
        `${baseUrl}/auth/google/callback?code=abc&state=wrong-state`,
        {
          redirect: 'manual',
          headers: { Cookie: `${COOKIE_NAMES.STATE_COOKIE}=expected-state` },
        },
      );
      assert.equal(response.status, 403);
      assert.match(await response.text(), /invalid oauth state/i);
    } finally {
      await closeServer(server);
    }
  });
});

test('callback rejects unmatched verified email with mocked google fetch', async () => {
  await withAuthEnv(async () => {
    const { datastore } = await createTestRuntime();
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (String(url).includes('oauth2.googleapis.com/token')) {
        return {
          ok: true,
          async json() {
            return { access_token: 'access-token' };
          },
        };
      }
      if (String(url).includes('openidconnect.googleapis.com/v1/userinfo')) {
        return {
          ok: true,
          async json() {
            return {
              email: 'unknown@example.com',
              email_verified: true,
            };
          },
        };
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    };

    try {
      const request = {
        url: '/auth/google/callback?code=auth-code&state=good-state',
        headers: { cookie: `${COOKIE_NAMES.STATE_COOKIE}=good-state` },
      };
      const headers = {};
      let statusCode = 0;
      let body = '';
      const response = {
        writeHead(code, responseHeaders = {}) {
          statusCode = code;
          Object.assign(headers, responseHeaders);
        },
        end(payload = '') {
          body = String(payload);
        },
      };

      await handleGoogleCallback(request, response, {
        datastore,
        fetchImpl: global.fetch,
      });

      assert.equal(statusCode, 403);
      assert.match(body, /no matching local user/i);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

test('session helpers sign and verify cookies and match users by email', async () => {
  const secret = 'helper-secret';
  const token = createSessionToken({ userId: 'u1', email: 'User@Example.com' }, secret, 60_000);
  const claims = verifySessionToken(token, secret);
  assert.equal(claims.userId, 'u1');
  assert.equal(claims.email, 'User@Example.com');
  assert.equal(verifySessionToken('bad.token', secret), null);

  const cookies = parseCookies(`${COOKIE_NAMES.SESSION_COOKIE}=abc; other=1`);
  assert.equal(cookies[COOKIE_NAMES.SESSION_COOKIE], 'abc');

  const { datastore } = await createTestRuntime();
  const matched = await findUserByEmail(datastore, 'TESTMASTER@EXAMPLE.COM');
  assert.equal(matched.id, 'testmaster');
  assert.equal(await findUserByEmail(datastore, 'missing@example.com'), null);

  await withAuthEnv(async () => {
    process.env.PUBLIC_BASE_URL = 'https://example.com/';
    const config = getGoogleAuthConfig();
    assert.equal(config.redirectUri, 'https://example.com/auth/google/callback');
    assert.equal(config.configured, true);
  });
});
