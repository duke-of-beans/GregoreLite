/**
 * types.ts — Ghost Thread Email Connector Types
 * Sprint 6B
 *
 * Shared interfaces for Gmail and Microsoft Graph connectors.
 * All body/attachment content is marked [UNTRUSTED CONTENT] before leaving
 * the connector layer (enforced in gmail.ts / graph.ts, not in consumers).
 */

export type EmailProvider = 'gmail' | 'outlook';

export interface EmailMessage {
  id: string;
  provider: EmailProvider;
  subject: string;
  from: string;
  to: string[];
  body: string;               // plaintext only — HTML stripped at connector layer
  receivedAt: number;         // Unix ms
  attachments: EmailAttachment[];
  threadId: string;
  labels?: string[];          // Gmail only
  isRead: boolean;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  content?: string;           // populated only if text-based AND under 10MB
}

export interface ConnectorStatus {
  provider: EmailProvider;
  account: string;
  connected: boolean;
  connectedAt: number | null;
  lastSyncAt: number | null;
  errorCount: number;
  historyCursor: string | null;
}

/** Attachment MIME types eligible for content indexing */
export const INDEXABLE_MIME_TYPES = new Set([
  'text/plain',
  'text/html',
  'text/csv',
  'text/markdown',
  'application/json',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/** Security prefix required on all email body/attachment content before any Claude API call */
export const UNTRUSTED_CONTENT_PREFIX = '[UNTRUSTED CONTENT] ';
