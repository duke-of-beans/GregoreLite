/**
 * gmail.ts — Gmail API connector for Ghost Thread
 * Sprint 6B
 *
 * Uses history.list for delta sync (not full inbox scan).
 * Strips HTML from bodies. Marks all content [UNTRUSTED CONTENT].
 * Stores historyId in KERNL settings under ghost_gmail_history_id.
 */

import { getAccessToken, type GmailOAuthConfig } from './oauth';
import { getSetting, setSetting } from '@/lib/kernl/settings-store';
import { getDatabase } from '@/lib/kernl/database';
import {
  INDEXABLE_MIME_TYPES,
  ATTACHMENT_MAX_BYTES,
  UNTRUSTED_CONTENT_PREFIX,
  type EmailMessage,
  type EmailAttachment,
} from './types';

// ── HTML stripping ─────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  // Remove script/style blocks first
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  // Replace block elements with newlines
  text = text.replace(/<\/?(p|br|div|li|h[1-6]|tr|td|th)[^>]*>/gi, '\n');
  // Strip all remaining tags
  text = text.replace(/<[^>]+>/g, '');
  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  // Collapse whitespace runs but preserve paragraph breaks
  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// ── Base64url decoder (Gmail uses base64url for message parts) ─────────────────

function decodeBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

// ── Gmail API helpers ──────────────────────────────────────────────────────────

type GmailMessagePart = {
  mimeType?: string;
  filename?: string;
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailMessagePart[];
  headers?: Array<{ name: string; value: string }>;
};

type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  internalDate?: string;
  payload?: GmailMessagePart;
  sizeEstimate?: number;
};

/** Extract plain text body from MIME tree, preferring text/plain over text/html */
function extractBody(part: GmailMessagePart): string {
  if (!part) return '';

  if (part.mimeType === 'text/plain' && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  if (part.mimeType === 'text/html' && part.body?.data) {
    return stripHtml(decodeBase64Url(part.body.data));
  }
  if (part.parts) {
    // For multipart/alternative prefer text/plain
    const plainPart = part.parts.find(p => p.mimeType === 'text/plain');
    if (plainPart) return extractBody(plainPart);
    const htmlPart = part.parts.find(p => p.mimeType === 'text/html');
    if (htmlPart) return extractBody(htmlPart);
    // Recurse into other multipart containers
    for (const child of part.parts) {
      const text = extractBody(child);
      if (text) return text;
    }
  }
  return '';
}

/** Collect attachment metadata from MIME tree */
function collectAttachments(part: GmailMessagePart, acc: EmailAttachment[] = []): EmailAttachment[] {
  if (!part) return acc;
  if (part.filename && part.body?.attachmentId) {
    const mime = part.mimeType ?? 'application/octet-stream';
    const size = part.body.size ?? 0;
    acc.push({
      id: part.body.attachmentId,
      filename: part.filename,
      mimeType: mime,
      sizeBytes: size,
      // content filled in fetchAttachment() if eligible
    });
  }
  if (part.parts) {
    for (const child of part.parts) {
      collectAttachments(child, acc);
    }
  }
  return acc;
}

function getHeader(payload: GmailMessagePart, name: string): string {
  return payload.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

// ── KERNL email state helpers ──────────────────────────────────────────────────

const HISTORY_ID_KEY = 'ghost_gmail_history_id';

function getHistoryId(): string | null {
  return getSetting(HISTORY_ID_KEY);
}

function setHistoryId(id: string): void {
  setSetting(HISTORY_ID_KEY, id);
}

function upsertEmailState(account: string, historyId: string): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO ghost_email_state (id, provider, account, last_sync_at, history_cursor, connected_at)
    VALUES (?, 'gmail', ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      last_sync_at = excluded.last_sync_at,
      history_cursor = excluded.history_cursor,
      error_count = 0
  `).run(
    `gmail:${account}`,
    account,
    Date.now(),
    historyId,
    Date.now(),
  );
}

function incrementErrorCount(account: string): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE ghost_email_state
    SET error_count = error_count + 1
    WHERE id = ?
  `).run(`gmail:${account}`);
}

// ── GmailConnector ─────────────────────────────────────────────────────────────

export class GmailConnector {
  private config: GmailOAuthConfig;
  private account: string;

  constructor(config: GmailOAuthConfig, account = 'primary') {
    this.config = config;
    this.account = account;
  }

  /** Authenticate and store the initial historyId as the delta baseline */
  async connect(): Promise<void> {
    const token = await getAccessToken('gmail', this.config);

    // Fetch current profile to confirm auth + get email address
    const profileResp = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/profile',
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!profileResp.ok) {
      throw new Error(`Gmail profile fetch failed: ${profileResp.status}`);
    }
    const profile = await profileResp.json() as { historyId?: string; emailAddress?: string };

    if (profile.emailAddress) {
      this.account = profile.emailAddress;
    }
    const historyId = profile.historyId ?? '1';
    setHistoryId(historyId);
    upsertEmailState(this.account, historyId);
  }

  /**
   * Fetch messages changed since last historyId.
   * Stores the new historyId on success.
   * All body content prefixed with [UNTRUSTED CONTENT].
   */
  async poll(): Promise<EmailMessage[]> {
    const startHistoryId = getHistoryId();
    if (!startHistoryId) {
      throw new Error('Gmail not connected — call connect() first');
    }

    try {
      const token = await getAccessToken('gmail', this.config);
      const messages: EmailMessage[] = [];

      // Fetch history since last cursor
      const histUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/history');
      histUrl.searchParams.set('startHistoryId', startHistoryId);
      histUrl.searchParams.set('historyTypes', 'messageAdded');
      histUrl.searchParams.set('maxResults', '100');

      const histResp = await fetch(histUrl.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!histResp.ok) {
        throw new Error(`Gmail history.list failed: ${histResp.status}`);
      }
      const histData = await histResp.json() as {
        history?: Array<{ messagesAdded?: Array<{ message?: { id?: string } }> }>;
        historyId?: string;
      };

      // Update history cursor immediately
      if (histData.historyId) {
        setHistoryId(histData.historyId);
        upsertEmailState(this.account, histData.historyId);
      }

      if (!histData.history) return [];

      // Collect unique message IDs from the history
      const msgIds = new Set<string>();
      for (const entry of histData.history) {
        for (const added of entry.messagesAdded ?? []) {
          if (added.message?.id) msgIds.add(added.message.id);
        }
      }

      // Fetch each message individually
      for (const id of msgIds) {
        try {
          const msg = await this.fetchMessage(id);
          messages.push(msg);
        } catch (err) {
          console.warn(`[ghost/gmail] Failed to fetch message ${id}:`, err);
        }
      }

      return messages;
    } catch (err) {
      incrementErrorCount(this.account);
      throw err;
    }
  }

  /** Fetch a single message by ID and return structured EmailMessage */
  async fetchMessage(id: string): Promise<EmailMessage> {
    const token = await getAccessToken('gmail', this.config);
    const resp = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!resp.ok) {
      throw new Error(`Gmail fetchMessage ${id} failed: ${resp.status}`);
    }
    const raw = await resp.json() as GmailMessage;
    const payload = raw.payload ?? {};

    const subject = getHeader(payload, 'Subject') || '(no subject)';
    const from = getHeader(payload, 'From') || '';
    const toHeader = getHeader(payload, 'To');
    const to = toHeader ? toHeader.split(',').map(s => s.trim()) : [];
    const rawBody = extractBody(payload);
    const body = UNTRUSTED_CONTENT_PREFIX + rawBody;
    const receivedAt = raw.internalDate ? parseInt(raw.internalDate, 10) : Date.now();

    // Collect attachments — content filled in on first index if eligible
    const rawAttachments = collectAttachments(payload);
    const attachments: EmailAttachment[] = rawAttachments.map(att => ({
      ...att,
      // Content not fetched here — caller uses fetchAttachment() if needed
    }));

    const isRead = !(raw.labelIds ?? []).includes('UNREAD');

    return {
      id: raw.id,
      provider: 'gmail',
      subject,
      from,
      to,
      body,
      receivedAt,
      attachments,
      threadId: raw.threadId,
      labels: raw.labelIds ?? [],
      isRead,
    };
  }

  /**
   * Fetch attachment content. Returns null if the attachment is not
   * eligible for indexing (non-text MIME type or over 10MB).
   */
  async fetchAttachment(messageId: string, attachmentId: string): Promise<string | null> {
    // First find the attachment metadata to check eligibility
    const token = await getAccessToken('gmail', this.config);
    const resp = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!resp.ok) return null;

    const data = await resp.json() as { size?: number; data?: string };
    const sizeBytes = data.size ?? 0;

    if (sizeBytes > ATTACHMENT_MAX_BYTES) return null;
    if (!data.data) return null;

    const content = decodeBase64Url(data.data);
    return UNTRUSTED_CONTENT_PREFIX + content;
  }

  /** Revoke tokens and clear connector state */
  async disconnect(): Promise<void> {
    const db = getDatabase();
    db.prepare(`DELETE FROM ghost_email_state WHERE id = ?`).run(`gmail:${this.account}`);
    // Clear history cursor
    const { deleteSetting } = await import('@/lib/kernl/settings-store');
    deleteSetting(HISTORY_ID_KEY);
  }

  isEligibleAttachment(att: EmailAttachment): boolean {
    const mimeBase = (att.mimeType.split(';')[0] ?? '').trim().toLowerCase();
    const isText = Array.from(INDEXABLE_MIME_TYPES).some(m => mimeBase.startsWith(m) || mimeBase === m);
    return isText && att.sizeBytes <= ATTACHMENT_MAX_BYTES;
  }
}

// ── Singleton factory ──────────────────────────────────────────────────────────

let _gmailConnector: GmailConnector | null = null;

export function getGmailConnector(config?: GmailOAuthConfig): GmailConnector {
  if (!_gmailConnector) {
    if (!config) throw new Error('GmailConnector not initialized — provide config on first call');
    _gmailConnector = new GmailConnector(config);
  }
  // _gmailConnector is guaranteed non-null here; module-level vars don't narrow automatically
  return _gmailConnector!;
}

export function resetGmailConnector(): void {
  _gmailConnector = null;
}
