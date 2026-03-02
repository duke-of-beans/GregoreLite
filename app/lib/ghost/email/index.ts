/**
 * index.ts — Public API for Ghost Thread Email Connectors
 * Sprint 6B
 *
 * Exposes connect/poll/disconnect for Gmail and Outlook.
 * Re-exports types and poller controls for consumers.
 */

// ── Re-exports ────────────────────────────────────────────────────────────────

export type {
  EmailMessage,
  EmailAttachment,
  ConnectorStatus,
  EmailProvider,
} from './types';

export {
  INDEXABLE_MIME_TYPES,
  ATTACHMENT_MAX_BYTES,
  UNTRUSTED_CONTENT_PREFIX,
} from './types';

export type { GmailOAuthConfig, GraphOAuthConfig } from './oauth';
export { initiateOAuth, getAccessToken, refreshIfExpired, revokeTokens } from './oauth';

export { GmailConnector, getGmailConnector, resetGmailConnector } from './gmail';
export { GraphConnector, getGraphConnector, resetGraphConnector } from './graph';

export { startEmailPoller, stopEmailPoller, isPollerRunning } from './poller';

// ── Connector lifecycle ───────────────────────────────────────────────────────

import type { GmailOAuthConfig, GraphOAuthConfig } from './oauth';
import { getGmailConnector } from './gmail';
import { getGraphConnector } from './graph';

/**
 * Connect a provider and start the poller if not already running.
 *
 * For Gmail: initializes the GmailConnector singleton and fetches the baseline historyId.
 * For Outlook: initializes the GraphConnector singleton and fetches the baseline delta link.
 *
 * Callers must run initiateOAuth(provider, config) before calling connect() on first use.
 */
export async function connectProvider(
  provider: 'gmail',
  config: GmailOAuthConfig,
): Promise<void>;
export async function connectProvider(
  provider: 'outlook',
  config: GraphOAuthConfig,
): Promise<void>;
export async function connectProvider(
  provider: 'gmail' | 'outlook',
  config: GmailOAuthConfig | GraphOAuthConfig,
): Promise<void> {
  if (provider === 'gmail') {
    const connector = getGmailConnector(config as GmailOAuthConfig);
    await connector.connect();
  } else {
    const connector = getGraphConnector(config as GraphOAuthConfig);
    await connector.connect();
  }

  // Start the poller once at least one provider is connected
  const { startEmailPoller } = await import('./poller');
  startEmailPoller();
}

/**
 * Disconnect a provider and clear its state.
 * Stops the poller if no other providers remain connected.
 */
export async function disconnectProvider(provider: 'gmail' | 'outlook'): Promise<void> {
  if (provider === 'gmail') {
    const { getGmailConnector, resetGmailConnector } = await import('./gmail');
    try {
      const connector = getGmailConnector();
      await connector.disconnect();
    } catch {
      // Connector not initialized — clear settings only
    }
    resetGmailConnector();
  } else {
    const { getGraphConnector, resetGraphConnector } = await import('./graph');
    try {
      const connector = getGraphConnector();
      await connector.disconnect();
    } catch {
      // Connector not initialized — clear settings only
    }
    resetGraphConnector();
  }

  // Check if any connectors remain — stop poller if none
  const { getDatabase } = await import('@/lib/kernl/database');
  try {
    const db = getDatabase();
    const remaining = db
      .prepare(`SELECT COUNT(*) as count FROM ghost_email_state WHERE connected_at IS NOT NULL`)
      .get() as { count: number };
    if (remaining.count === 0) {
      const { stopEmailPoller } = await import('./poller');
      stopEmailPoller();
    }
  } catch {
    // Best effort — poller can be stopped manually if needed
  }
}
