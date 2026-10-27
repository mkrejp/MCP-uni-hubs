import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const SESSION_COOKIE = 'mcp_session';
const STATE_COOKIE = 'mcp_oauth_state';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const STATE_TTL_MS = 10 * 60 * 1000;
const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

/**
 * Read Google OAuth and session configuration from environment variables.
 * @returns {{clientId: string, clientSecret: string, sessionSecret: string, publicBaseUrl: string, redirectUri: string, configured: boolean}}
 */
export function getGoogleAuthConfig() {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const sessionSecret = String(process.env.SESSION_SECRET || '').trim();
  const publicBaseUrl = String(process.env.PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
  const redirectUri = publicBaseUrl ? `${publicBaseUrl}/auth/google/callback` : '';

  return {
    clientId,
    clientSecret,
    sessionSecret,
    publicBaseUrl,
    redirectUri,
    configured: Boolean(clientId && clientSecret && sessionSecret && publicBaseUrl),
  };
}

/**
 * Parse Cookie header into a plain object.
 * @param {string | undefined} cookieHeader
 * @returns {Record<string, string>}
 */
export function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) {
    return cookies;
  }

  for (const part of cookieHeader.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) {
      continue;
    }
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) {
      cookies[key] = decodeURIComponent(value);
    }
  }
  return cookies;
}

/**
 * Build a Set-Cookie header value.
 * @param {string} name
 * @param {string} value
 * @param {{maxAge?: number, httpOnly?: boolean, secure?: boolean, sameSite?: string, path?: string}} [options]
 * @returns {string}
 */
export function buildSetCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || '/'}`);
  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }
  if (options.httpOnly !== false) {
    parts.push('HttpOnly');
  }
  if (options.secure !== false) {
    parts.push('Secure');
  }
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);
  return parts.join('; ');
}

/**
 * @param {string} name
 * @returns {string}
 */
function clearCookie(name) {
  return buildSetCookie(name, '', { maxAge: 0 });
}

/**
 * @param {string} secret
 * @param {string} payload
 * @returns {string}
 */
function signPayload(secret, payload) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/**
 * @param {string} left
 * @param {string} right
 * @returns {boolean}
 */
function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * Create a signed session token for the given user.
 * @param {{userId: string, email: string}} user
 * @param {string} sessionSecret
 * @param {number} [ttlMs]
 * @returns {string}
 */
export function createSessionToken(user, sessionSecret, ttlMs = SESSION_TTL_MS) {
  const exp = Date.now() + ttlMs;
  const payload = Buffer.from(JSON.stringify({
    userId: user.userId,
    email: user.email,
    exp,
  })).toString('base64url');
  const signature = signPayload(sessionSecret, payload);
  return `${payload}.${signature}`;
}

/**
 * Verify a signed session token and return claims when valid.
 * @param {string | undefined} token
 * @param {string} sessionSecret
 * @returns {{userId: string, email: string, exp: number} | null}
 */
export function verifySessionToken(token, sessionSecret) {
  if (!token || !sessionSecret || !token.includes('.')) {
    return null;
  }

  const [payload, signature] = token.split('.');
  if (!payload || !signature) {
    return null;
  }

  const expected = signPayload(sessionSecret, payload);
  if (!safeEqual(signature, expected)) {
    return null;
  }

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!claims || typeof claims !== 'object') {
      return null;
    }
    if (!claims.userId || !claims.email || typeof claims.exp !== 'number') {
      return null;
    }
    if (claims.exp < Date.now()) {
      return null;
    }
    return {
      userId: String(claims.userId),
      email: String(claims.email),
      exp: claims.exp,
    };
  } catch {
    return null;
  }
}

/**
 * Read the current session from request cookies.
 * @param {import('node:http').IncomingMessage} request
 * @param {string} [sessionSecret]
 * @returns {{userId: string, email: string, exp: number} | null}
 */
export function readSession(request, sessionSecret = getGoogleAuthConfig().sessionSecret) {
  const cookies = parseCookies(request.headers.cookie);
  return verifySessionToken(cookies[SESSION_COOKIE], sessionSecret);
}

/**
 * Require a valid session; returns the session or null.
 * @param {import('node:http').IncomingMessage} request
 * @param {string} [sessionSecret]
 * @returns {{userId: string, email: string, exp: number} | null}
 */
export function requireAuth(request, sessionSecret = getGoogleAuthConfig().sessionSecret) {
  return readSession(request, sessionSecret);
}

/**
 * Find a datastore user whose email matches (case-insensitive).
 * @param {{list: Function, read: Function}} datastore
 * @param {string} email
 * @returns {Promise<object | null>}
 */
export async function findUserByEmail(datastore, email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !datastore) {
    return null;
  }

  for (const id of await datastore.list('users')) {
    const user = await datastore.read('users', id);
    if (!user) {
      continue;
    }
    if (String(user.email || '').trim().toLowerCase() === normalized) {
      return user;
    }
  }
  return null;
}

/**
 * Build the Google OAuth authorization URL.
 * @param {{clientId: string, redirectUri: string, state: string}} options
 * @returns {string}
 */
export function buildAuthorizeUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Start the Google OAuth login flow.
 * @param {import('node:http').IncomingMessage} request
 * @param {import('node:http').ServerResponse} response
 * @returns {void}
 */
export function startGoogleLogin(request, response) {
  const config = getGoogleAuthConfig();
  if (!config.clientId) {
    response.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({
      error: 'Google authentication is not configured',
      detail: 'GOOGLE_CLIENT_ID is not set',
    }));
    return;
  }

  if (!config.configured) {
    response.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({
      error: 'Google authentication is not configured',
      detail: 'GOOGLE_CLIENT_SECRET, SESSION_SECRET, and PUBLIC_BASE_URL are required',
    }));
    return;
  }

  const state = randomBytes(24).toString('base64url');
  const authorizeUrl = buildAuthorizeUrl({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    state,
  });

  response.writeHead(302, {
    Location: authorizeUrl,
    'Set-Cookie': buildSetCookie(STATE_COOKIE, state, {
      maxAge: Math.floor(STATE_TTL_MS / 1000),
    }),
  });
  response.end();
}

/**
 * Exchange an authorization code for Google tokens.
 * @param {{code: string, clientId: string, clientSecret: string, redirectUri: string}} options
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{access_token?: string, id_token?: string, error?: string}>}
 */
export async function exchangeAuthorizationCode(options, fetchImpl = fetch) {
  const body = new URLSearchParams({
    code: options.code,
    client_id: options.clientId,
    client_secret: options.clientSecret,
    redirect_uri: options.redirectUri,
    grant_type: 'authorization_code',
  });

  const tokenResponse = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const payload = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok) {
    return { error: payload.error || 'token_exchange_failed' };
  }
  return payload;
}

/**
 * Fetch OpenID Connect userinfo for an access token.
 * @param {string} accessToken
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{email?: string, email_verified?: boolean, error?: string}>}
 */
export async function fetchGoogleUserInfo(accessToken, fetchImpl = fetch) {
  const userInfoResponse = await fetchImpl(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await userInfoResponse.json().catch(() => ({}));
  if (!userInfoResponse.ok) {
    return { error: payload.error || 'userinfo_failed' };
  }
  return payload;
}

/**
 * Handle the Google OAuth callback.
 * @param {import('node:http').IncomingMessage} request
 * @param {import('node:http').ServerResponse} response
 * @param {{datastore: {list: Function, read: Function}, fetchImpl?: typeof fetch}} options
 * @returns {Promise<void>}
 */
export async function handleGoogleCallback(request, response, { datastore, fetchImpl = fetch }) {
  const config = getGoogleAuthConfig();
  if (!config.configured) {
    response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Google authentication is not configured');
    return;
  }

  const url = new URL(request.url, config.publicBaseUrl || 'http://localhost');
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  const cookies = parseCookies(request.headers.cookie);
  const expectedState = cookies[STATE_COOKIE] || '';

  if (!code || !state || !expectedState || !safeEqual(state, expectedState)) {
    response.writeHead(403, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Set-Cookie': clearCookie(STATE_COOKIE),
    });
    response.end('Invalid OAuth state');
    return;
  }

  const tokenPayload = await exchangeAuthorizationCode({
    code,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
  }, fetchImpl);

  if (!tokenPayload.access_token) {
    response.writeHead(403, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Set-Cookie': clearCookie(STATE_COOKIE),
    });
    response.end('Unable to exchange authorization code');
    return;
  }

  const userInfo = await fetchGoogleUserInfo(tokenPayload.access_token, fetchImpl);
  if (!userInfo.email || userInfo.email_verified !== true) {
    response.writeHead(403, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Set-Cookie': clearCookie(STATE_COOKIE),
    });
    response.end('Google account email is missing or not verified');
    return;
  }

  const localUser = await findUserByEmail(datastore, userInfo.email);
  if (!localUser) {
    response.writeHead(403, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Set-Cookie': clearCookie(STATE_COOKIE),
    });
    response.end('No matching local user for this Google account');
    return;
  }

  const sessionToken = createSessionToken({
    userId: localUser.id,
    email: localUser.email,
  }, config.sessionSecret);

  response.writeHead(302, {
    Location: '/',
    'Set-Cookie': [
      buildSetCookie(SESSION_COOKIE, sessionToken, {
        maxAge: Math.floor(SESSION_TTL_MS / 1000),
      }),
      clearCookie(STATE_COOKIE),
    ],
  });
  response.end();
}

/**
 * Clear the session cookie and redirect home.
 * @param {import('node:http').IncomingMessage} _request
 * @param {import('node:http').ServerResponse} response
 * @returns {void}
 */
export function logout(_request, response) {
  response.writeHead(302, {
    Location: '/',
    'Set-Cookie': clearCookie(SESSION_COOKIE),
  });
  response.end();
}

/**
 * Write the current authenticated user as JSON, or 401.
 * @param {import('node:http').IncomingMessage} request
 * @param {import('node:http').ServerResponse} response
 * @param {{datastore: {read: Function}}} options
 * @returns {Promise<void>}
 */
export async function handleMe(request, response, { datastore }) {
  const session = readSession(request);
  if (!session) {
    response.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  const user = await datastore.read('users', session.userId);
  response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({
    authenticated: true,
    user: {
      id: session.userId,
      email: session.email,
      username: user?.username || session.userId,
    },
  }));
}

export const COOKIE_NAMES = {
  SESSION_COOKIE,
  STATE_COOKIE,
};
