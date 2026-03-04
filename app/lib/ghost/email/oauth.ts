/**
 * oauth.ts — OAuth 2.0 flow for Ghost Thread email connectors
 * Sprint 6B
 *
 * Opens the OAuth URL in the default browser via Tauri shell plugin.
 * Listens for the authorization code on a local HTTP server (port 47832).
 * Exchanges code for tokens, stores in OS keychain via keychain.ts.
 * Handles token refresh automatically before expiry.
 */

import * as http from 'http';
import { URL } from 'url';
import { randomUUID } from 'crypto';
import { getSecret, setSecret, deleteSecret, TOKEN_KEYS } from './keychain';
import type { EmailProvider } from './types';

// ── Constants ──────────────────────────────────────────────────────────────────

export const REDIRECT_PORT = 47832;
export const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth/callback`;

// Scopes required for Ghost Thread email access
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

const GRAPH_SCOPES = [
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/User.Read',
  'offline_access',
].join(' ');

// Token expiry buffer — refresh 5 minutes before actual expiry
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

// ── OAuth URL builders ─────────────────────────────────────────────────────────

function buildGmailAuthUrl(clientId: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: GMAIL_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

function buildGraphAuthUrl(clientId: string, tenantId: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: GRAPH_SCOPES,
    state,
  });
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`;
}

// ── Local redirect server ──────────────────────────────────────────────────────

/**
 * Spin up a one-shot HTTP server on REDIRECT_PORT.
 * Resolves with the authorization code or rejects on timeout/error.
 */
function waitForAuthCode(expectedState: string, timeoutMs = 120_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url ?? '/', `http://localhost:${REDIRECT_PORT}`);
        if (url.pathname !== '/oauth/callback') {
          res.writeHead(404);
          res.end();
          return;
        }
        const error = url.searchParams.get('error');
        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<html><body><h2>Authorization failed.</h2><p>You can close this tab.</p></body></html>');
          server.close();
          reject(new Error(`OAuth error: ${error} — ${url.searchParams.get('error_description') ?? ''}`));
          return;
        }
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<html><body><h2>No code received.</h2></body></html>');
          server.close();
          reject(new Error('No authorization code in callback'));
          return;
        }
        if (state !== expectedState) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<html><body><h2>State mismatch — possible CSRF.</h2></body></html>');
          server.close();
          reject(new Error('OAuth state mismatch'));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>✓ Connected to Gregore Lite</h2><p>You can close this tab.</p></body></html>');
        server.close();
        resolve(code);
      } catch (err) {
        server.close();
        reject(err);
      }
    });

    server.listen(REDIRECT_PORT, '127.0.0.1', () => {
      // server is ready
    });

    server.on('error', (err) => {
      reject(new Error(`Redirect server error: ${(err as Error).message}`));
    });

    setTimeout(() => {
      server.close();
      reject(new Error('OAuth timeout — no callback received within 2 minutes'));
    }, timeoutMs);
  });
}

// ── Browser opener ─────────────────────────────────────────────────────────────

async function openInBrowser(url: string): Promise<void> {
  // Only attempt Tauri shell in actual Tauri runtime.
  // webpackIgnore prevents Turbopack/webpack from resolving this module at
  // build time, eliminating the "Module not found" warning during pnpm dev.
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error — @tauri-apps/plugin-shell only resolves at Tauri runtime
      const { open } = await import(/* webpackIgnore: true */ '@tauri-apps/plugin-shell');
      await open(url);
      return;
    } catch {
      // Fall through to Node.js fallback
    }
  }

  // Non-Tauri context (Node.js / dev server): open URL via child_process
  const { exec } = await import('child_process');
  const cmd = process.platform === 'win32'
    ? `start "" "${url}"`
    : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`;
  exec(cmd);
}

// ── Token exchange — Gmail ─────────────────────────────────────────────────────

async function exchangeGmailCode(
  code: string,
  clientId: string,
  clientSecret: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Gmail token exchange failed (${resp.status}): ${body}`);
  }
  const data = await resp.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

async function refreshGmailToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt: number }> {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Gmail token refresh failed (${resp.status}): ${body}`);
  }
  const data = await resp.json() as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

// ── Token exchange — Microsoft Graph ──────────────────────────────────────────

async function exchangeGraphCode(
  code: string,
  clientId: string,
  clientSecret: string,
  tenantId: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const resp = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    },
  );
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Graph token exchange failed (${resp.status}): ${body}`);
  }
  const data = await resp.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

async function refreshGraphToken(
  clientId: string,
  clientSecret: string,
  tenantId: string,
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt: number }> {
  const resp = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    },
  );
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Graph token refresh failed (${resp.status}): ${body}`);
  }
  const data = await resp.json() as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

// ── Public OAuth API ───────────────────────────────────────────────────────────

export interface GmailOAuthConfig {
  clientId: string;
  clientSecret: string;
}

export interface GraphOAuthConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
}

/**
 * Initiate OAuth flow for the given provider.
 * Opens browser → waits for redirect → exchanges code → stores tokens.
 */
export async function initiateOAuth(
  provider: 'gmail',
  config: GmailOAuthConfig,
): Promise<void>;
export async function initiateOAuth(
  provider: 'outlook',
  config: GraphOAuthConfig,
): Promise<void>;
export async function initiateOAuth(
  provider: EmailProvider,
  config: GmailOAuthConfig | GraphOAuthConfig,
): Promise<void> {
  const state = randomUUID();

  let authUrl: string;
  if (provider === 'gmail') {
    const c = config as GmailOAuthConfig;
    authUrl = buildGmailAuthUrl(c.clientId, state);
  } else {
    const c = config as GraphOAuthConfig;
    authUrl = buildGraphAuthUrl(c.clientId, c.tenantId, state);
  }

  await openInBrowser(authUrl);
  const code = await waitForAuthCode(state);

  if (provider === 'gmail') {
    const c = config as GmailOAuthConfig;
    const tokens = await exchangeGmailCode(code, c.clientId, c.clientSecret);
    await setSecret(TOKEN_KEYS.gmailAccess, tokens.accessToken);
    await setSecret(TOKEN_KEYS.gmailRefresh, tokens.refreshToken);
    await setSecret(TOKEN_KEYS.gmailExpiry, String(tokens.expiresAt));
  } else {
    const c = config as GraphOAuthConfig;
    const tokens = await exchangeGraphCode(code, c.clientId, c.clientSecret, c.tenantId);
    await setSecret(TOKEN_KEYS.outlookAccess, tokens.accessToken);
    await setSecret(TOKEN_KEYS.outlookRefresh, tokens.refreshToken);
    await setSecret(TOKEN_KEYS.outlookExpiry, String(tokens.expiresAt));
  }
}

/**
 * Return a valid access token, refreshing if needed.
 * Throws if no refresh token is stored (user must re-authenticate).
 */
export async function getAccessToken(
  provider: 'gmail',
  config: GmailOAuthConfig,
): Promise<string>;
export async function getAccessToken(
  provider: 'outlook',
  config: GraphOAuthConfig,
): Promise<string>;
export async function getAccessToken(
  provider: EmailProvider,
  config: GmailOAuthConfig | GraphOAuthConfig,
): Promise<string> {
  await refreshIfExpired(provider, config as GmailOAuthConfig & GraphOAuthConfig);

  const key = provider === 'gmail' ? TOKEN_KEYS.gmailAccess : TOKEN_KEYS.outlookAccess;
  const token = await getSecret(key);
  if (!token) throw new Error(`No ${provider} access token — please run initiateOAuth()`);
  return token;
}

/**
 * Refresh the access token if it is within EXPIRY_BUFFER_MS of expiry.
 * No-op if token is still fresh.
 */
export async function refreshIfExpired(
  provider: EmailProvider,
  config: GmailOAuthConfig & GraphOAuthConfig,
): Promise<void> {
  const expiryKey = provider === 'gmail' ? TOKEN_KEYS.gmailExpiry : TOKEN_KEYS.outlookExpiry;
  const expiryStr = await getSecret(expiryKey);
  const expiresAt = expiryStr ? parseInt(expiryStr, 10) : 0;

  if (Date.now() < expiresAt - EXPIRY_BUFFER_MS) return; // still fresh

  const refreshKey = provider === 'gmail' ? TOKEN_KEYS.gmailRefresh : TOKEN_KEYS.outlookRefresh;
  const refreshToken = await getSecret(refreshKey);
  if (!refreshToken) throw new Error(`No ${provider} refresh token — please run initiateOAuth()`);

  if (provider === 'gmail') {
    const { accessToken, expiresAt: newExpiry } = await refreshGmailToken(
      config.clientId,
      config.clientSecret,
      refreshToken,
    );
    await setSecret(TOKEN_KEYS.gmailAccess, accessToken);
    await setSecret(TOKEN_KEYS.gmailExpiry, String(newExpiry));
  } else {
    const { accessToken, expiresAt: newExpiry } = await refreshGraphToken(
      config.clientId,
      config.clientSecret,
      config.tenantId,
      refreshToken,
    );
    await setSecret(TOKEN_KEYS.outlookAccess, accessToken);
    await setSecret(TOKEN_KEYS.outlookExpiry, String(newExpiry));
  }
}

/**
 * Revoke tokens and remove from keychain.
 */
export async function revokeTokens(provider: EmailProvider): Promise<void> {
  if (provider === 'gmail') {
    const token = await getSecret(TOKEN_KEYS.gmailAccess);
    if (token) {
      // Best-effort revocation — ignore errors
      fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
        method: 'POST',
      }).catch(() => undefined);
    }
    await deleteSecret(TOKEN_KEYS.gmailAccess);
    await deleteSecret(TOKEN_KEYS.gmailRefresh);
    await deleteSecret(TOKEN_KEYS.gmailExpiry);
  } else {
    // Microsoft Graph doesn't have a simple revoke endpoint — just clear locally
    await deleteSecret(TOKEN_KEYS.outlookAccess);
    await deleteSecret(TOKEN_KEYS.outlookRefresh);
    await deleteSecret(TOKEN_KEYS.outlookExpiry);
  }
}

// Re-export for use by connectors
export { REDIRECT_URI as OAUTH_REDIRECT_URI };
