import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildDashboardData, createApplicationRuntime } from './app-runtime.js';
import {
  handleGoogleCallback,
  handleMe,
  logout,
  requireAuth,
  startGoogleLogin,
} from './google-auth.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const LOGIN_PAGE = ['login.html', 'text/html; charset=utf-8'];
const DASHBOARD_FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
};

const CSP = "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; img-src 'self' data:";
const LOGIN_CSP = "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'none'; img-src 'self' data:";

/**
 * Send a static file from the public directory.
 * @param {import('node:http').ServerResponse} response
 * @param {[string, string]} asset
 * @param {string} [contentSecurityPolicy]
 * @returns {void}
 */
function sendPublicFile(response, asset, contentSecurityPolicy = CSP) {
  try {
    const content = readFileSync(`${PUBLIC_DIR}${asset[0]}`);
    response.writeHead(200, {
      'Content-Type': asset[1],
      'Content-Security-Policy': contentSecurityPolicy,
    });
    response.end(content);
  } catch (error) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Asset not found');
  }
}

/**
 * Create the HTTP dashboard server with Google OAuth protection for the site.
 * @param {{datastore: object}} runtime
 * @returns {import('node:http').Server}
 */
export function createDashboardServer(runtime) {
  return createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cache-Control', 'no-store');

    const method = request.method || 'GET';
    const isGet = method === 'GET';
    const isPost = method === 'POST';

    if (pathname === '/auth/google' && isGet) {
      startGoogleLogin(request, response);
      return;
    }

    if (pathname === '/auth/google/callback' && isGet) {
      await handleGoogleCallback(request, response, { datastore: runtime.datastore });
      return;
    }

    if (pathname === '/auth/logout' && (isGet || isPost)) {
      logout(request, response);
      return;
    }

    if (pathname === '/api/me' && isGet) {
      await handleMe(request, response, { datastore: runtime.datastore });
      return;
    }

    if (pathname === '/api/dashboard' && isGet) {
      const session = requireAuth(request);
      if (!session) {
        response.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      try {
        const dashboard = await buildDashboardData(runtime);
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify(dashboard));
      } catch (error) {
        response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ error: 'Unable to load dashboard data' }));
      }
      return;
    }

    if (!isGet) {
      response.writeHead(405, { Allow: 'GET, POST' });
      response.end('Method not allowed');
      return;
    }

    const session = requireAuth(request);
    if (!session) {
      if (pathname === '/') {
        sendPublicFile(response, LOGIN_PAGE, LOGIN_CSP);
        return;
      }

      if (DASHBOARD_FILES[pathname]) {
        response.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Unauthorized');
        return;
      }

      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    const asset = DASHBOARD_FILES[pathname];
    if (!asset) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    sendPublicFile(response, asset);
  });
}

function isMainModule() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  const runtime = await createApplicationRuntime();
  const server = createDashboardServer(runtime);
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';

  server.listen(port, host, () => {
    console.log(`Dashboard available at http://localhost:${port}`);
  });
}
