/**
 * graph.ts — Microsoft Graph connector for Ghost Thread
 * Sprint 6B
 *
 * Uses Graph delta queries for delta sync (not full mailbox scan).
 * Strips HTML from bodies. Marks all content [UNTRUSTED CONTENT].
 * Stores delta link in KERNL settings under ghost_graph_delta_link.
 */

import { getAccessToken, type GraphOAuthConfig } from './oauth';
import { getSetting, setSetting, deleteSetting } from '@/lib/kernl/settings-store';
import { getDatabase } from '@/lib/kernl/database';
import {
  INDEXABLE_MIME_TYPES,
  ATTACHMENT_MAX_BYTES,
  UNTRUSTED_CONTENT_PREFIX,
  type EmailMessage,
  type EmailAttachment,
} from './types';

// ── HTML stripping (same approach as gmail.ts — no new deps) ──────────────────

function stripHtml(html: string): string {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<\/?(p|br|div|li|h[1-6]|tr|td|th)[^>]*>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// ── Graph API types ───────────────────────────────────────────────────────────

interface GraphRecipient {
  emailAddress?: { address?: string; name?: string };
}

interface GraphEmailBody {
  contentType?: 'text' | 'html';
  content?: string;
}

interface GraphAttachment {
  id?: string;
  name?: string;
  contentType?: string;
  size?: number;
  '@odata.type'?: string;
  contentBytes?: string;       // only present if $expand=attachments and is file attachment
}

interface GraphMessage {
  id?: string;
  conversationId?: string;
  subject?: string;
  from?: GraphRecipient;
  toRecipients?: GraphRecipient[];
  body?: GraphEmailBody;
  receivedDateTime?: string;
  isRead?: boolean;
  hasAttachments?: boolean;
  categories?: string[];
  attachments?: GraphAttachment[];
}

interface GraphDeltaResponse {
  value?: GraphMessage[];
  '@odata.nextLink'?: string;
  '@odata.deltaLink'?: string;
}

// ── Graph API base URL ────────────────────────────────────────────────────────

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

// ── KERNL state helpers ───────────────────────────────────────────────────────

const DELTA_LINK_KEY = 'ghost_graph_delta_link';

function getDeltaLink(): string | null {
  return getSetting(DELTA_LINK_KEY);
}

function setDeltaLink(link: string): void {
  setSetting(DELTA_LINK_KEY, link);
}

function upsertEmailState(account: string, deltaLink: string): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO ghost_email_state (id, provider, account, last_sync_at, history_cursor, connected_at)
    VALUES (?, 'outlook', ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      last_sync_at = excluded.last_sync_at,
      history_cursor = excluded.history_cursor,
      error_count = 0
  `).run(
    `outlook:${account}`,
    account,
    Date.now(),
    deltaLink,
    Date.now(),
  );
}

function incrementErrorCount(account: string): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE ghost_email_state
    SET error_count = error_count + 1
    WHERE id = ?
  `).run(`outlook:${account}`);
}

// ── Graph API helpers ─────────────────────────────────────────────────────────

function getRecipientAddress(r: GraphRecipient | undefined): string {
  if (!r?.emailAddress) return '';
  const { name, address } = r.emailAddress;
  if (name && address) return `${name} <${address}>`;
  return address ?? name ?? '';
}

function buildEmailMessage(raw: GraphMessage, _account: string): EmailMessage {
  const rawBody = raw.body
    ? raw.body.contentType === 'html'
      ? stripHtml(raw.body.content ?? '')
      : (raw.body.content ?? '')
    : '';

  const to = (raw.toRecipients ?? []).map(getRecipientAddress).filter(Boolean);

  const attachments: EmailAttachment[] = (raw.attachments ?? [])
    .filter(a => a['@odata.type'] === '#microsoft.graph.fileAttachment')
    .map(a => ({
      id: a.id ?? '',
      filename: a.name ?? '',
      mimeType: a.contentType ?? 'application/octet-stream',
      sizeBytes: a.size ?? 0,
      // content populated by fetchAttachment() if eligible
    }));

  return {
    id: raw.id ?? '',
    provider: 'outlook',
    subject: raw.subject ?? '(no subject)',
    from: getRecipientAddress(raw.from),
    to,
    body: UNTRUSTED_CONTENT_PREFIX + rawBody,
    receivedAt: raw.receivedDateTime ? new Date(raw.receivedDateTime).getTime() : Date.now(),
    attachments,
    threadId: raw.conversationId ?? raw.id ?? '',
    isRead: raw.isRead ?? false,
  };
}

/** Fetch all pages of a delta response, returning messages + final delta link */
async function consumeDelta(
  startUrl: string,
  token: string,
): Promise<{ messages: GraphMessage[]; deltaLink: string }> {
  const messages: GraphMessage[] = [];
  let nextUrl: string | undefined = startUrl;
  let deltaLink = '';

  while (nextUrl) {
    const resp = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      throw new Error(`Graph delta request failed: ${resp.status}`);
    }
    const data = await resp.json() as GraphDeltaResponse;
    if (data.value) messages.push(...data.value);

    if (data['@odata.deltaLink']) {
      deltaLink = data['@odata.deltaLink'];
      break;
    }
    nextUrl = data['@odata.nextLink'];
  }

  return { messages, deltaLink };
}

// ── GraphConnector ────────────────────────────────────────────────────────────

export class GraphConnector {
  private config: GraphOAuthConfig;
  private account: string;

  constructor(config: GraphOAuthConfig, account = 'primary') {
    this.config = config;
    this.account = account;
  }

  /**
   * Authenticate and store the initial delta link as the baseline.
   * Uses $select to minimize payload on the seeding call.
   */
  async connect(): Promise<void> {
    const token = await getAccessToken('outlook', this.config);

    // Confirm auth — fetch user profile for account email
    const profileResp = await fetch(`${GRAPH_BASE}/me?$select=mail,userPrincipalName`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!profileResp.ok) {
      throw new Error(`Graph profile fetch failed: ${profileResp.status}`);
    }
    const profile = await profileResp.json() as { mail?: string; userPrincipalName?: string };
    if (profile.mail || profile.userPrincipalName) {
      this.account = profile.mail ?? profile.userPrincipalName!;
    }

    // Seed the delta with a minimal query — this gives us the initial deltaLink
    // We request fields only, no message bodies, to keep the seed fast
    const seedUrl = `${GRAPH_BASE}/me/messages/delta?$select=id&$top=1`;
    const { deltaLink } = await consumeDelta(seedUrl, token);

    if (!deltaLink) {
      throw new Error('Graph delta seed returned no deltaLink');
    }
    setDeltaLink(deltaLink);
    upsertEmailState(this.account, deltaLink);
  }

  /**
   * Fetch messages since the last stored delta link.
   * Automatically advances the delta cursor on success.
   */
  async poll(): Promise<EmailMessage[]> {
    const currentDeltaLink = getDeltaLink();
    if (!currentDeltaLink) {
      throw new Error('Graph not connected — call connect() first');
    }

    try {
      const token = await getAccessToken('outlook', this.config);

      // Expand attachments inline to avoid N+1 fetches for has-attachment messages
      // Graph allows $expand=attachments on delta but only returns metadata (no contentBytes)
      const expandedDeltaUrl = currentDeltaLink.includes('$expand=')
        ? currentDeltaLink
        : `${currentDeltaLink}${currentDeltaLink.includes('?') ? '&' : '?'}$expand=attachments($select=id,name,contentType,size,@odata.type)`;

      const { messages, deltaLink } = await consumeDelta(expandedDeltaUrl, token);

      // Advance the cursor immediately even if message processing partially fails
      if (deltaLink) {
        setDeltaLink(deltaLink);
        upsertEmailState(this.account, deltaLink);
      }

      const results: EmailMessage[] = [];
      for (const raw of messages) {
        // Delta queries also return deletion notifications (only have @removed + id)
        // Skip these — we don't tombstone emails in the index
        if (!(raw as { '@removed'?: unknown })['@removed'] && raw.id) {
          results.push(buildEmailMessage(raw, this.account));
        }
      }

      return results;
    } catch (err) {
      incrementErrorCount(this.account);
      throw err;
    }
  }

  /** Fetch a single message by ID */
  async fetchMessage(id: string): Promise<EmailMessage> {
    const token = await getAccessToken('outlook', this.config);
    const resp = await fetch(
      `${GRAPH_BASE}/me/messages/${id}?$expand=attachments($select=id,name,contentType,size,@odata.type)`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!resp.ok) {
      throw new Error(`Graph fetchMessage ${id} failed: ${resp.status}`);
    }
    const raw = await resp.json() as GraphMessage;
    return buildEmailMessage(raw, this.account);
  }

  /**
   * Fetch attachment content. Returns null if the attachment is not
   * eligible for indexing (non-text MIME type or over 10MB).
   */
  async fetchAttachment(messageId: string, attachmentId: string): Promise<string | null> {
    const token = await getAccessToken('outlook', this.config);

    // Fetch with contentBytes to get the actual data
    const resp = await fetch(
      `${GRAPH_BASE}/me/messages/${messageId}/attachments/${attachmentId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!resp.ok) return null;

    const att = await resp.json() as GraphAttachment & { contentBytes?: string; size?: number };
    const sizeBytes = att.size ?? 0;

    if (sizeBytes > ATTACHMENT_MAX_BYTES) return null;

    // Check MIME eligibility
    const mimeBase = ((att.contentType ?? '').split(';')[0] ?? '').trim().toLowerCase();
    const isEligible = Array.from(INDEXABLE_MIME_TYPES).some(
      m => mimeBase.startsWith(m) || mimeBase === m,
    );
    if (!isEligible) return null;
    if (!att.contentBytes) return null;

    const content = Buffer.from(att.contentBytes, 'base64').toString('utf-8');
    return UNTRUSTED_CONTENT_PREFIX + content;
  }

  /** Revoke tokens and clear connector state */
  async disconnect(): Promise<void> {
    const db = getDatabase();
    db.prepare(`DELETE FROM ghost_email_state WHERE id = ?`).run(`outlook:${this.account}`);
    deleteSetting(DELTA_LINK_KEY);
  }

  isEligibleAttachment(att: EmailAttachment): boolean {
    const mimeBase = (att.mimeType.split(';')[0] ?? '').trim().toLowerCase();
    const isText = Array.from(INDEXABLE_MIME_TYPES).some(m => mimeBase.startsWith(m) || mimeBase === m);
    return isText && att.sizeBytes <= ATTACHMENT_MAX_BYTES;
  }
}

// ── Singleton factory ─────────────────────────────────────────────────────────

let _graphConnector: GraphConnector | null = null;

export function getGraphConnector(config?: GraphOAuthConfig): GraphConnector {
  if (!_graphConnector) {
    if (!config) throw new Error('GraphConnector not initialized — provide config on first call');
    _graphConnector = new GraphConnector(config);
  }
  // _graphConnector is guaranteed non-null here; module-level vars don't narrow automatically
  return _graphConnector!;
}

export function resetGraphConnector(): void {
  _graphConnector = null;
}
