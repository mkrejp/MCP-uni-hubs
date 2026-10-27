import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildDashboardData, createApplicationRuntime } from './app-runtime.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const STATIC_FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
};

export function createDashboardServer(runtime) {
  return createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cache-Control', 'no-store');

    if (request.method !== 'GET') {
      response.writeHead(405, { Allow: 'GET' });
      response.end('Method not allowed');
      return;
    }

    if (pathname === '/api/dashboard') {
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

    const asset = STATIC_FILES[pathname];
    if (!asset) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    try {
      const content = readFileSync(`${PUBLIC_DIR}${asset[0]}`);
      response.writeHead(200, {
        'Content-Type': asset[1],
        'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:",
      });
      response.end(content);
    } catch (error) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Asset not found');
    }
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
