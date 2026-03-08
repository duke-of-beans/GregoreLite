/**
 * Format Adapter — Google Gemini Takeout Import — Sprint 35.0 / EPIC-81
 *
 * Expected Gemini Takeout structure (top-level array):
 *   [{ title?: string, conversations: [{ id: string, createTime: string|number,
 *      messages: [{ author: 'user'|'model', content: string }] }] }]
 *
 * Mapping rules:
 *   author 'model' → role 'assistant'
 *   author 'user'  → role 'user'
 *   source_platform: 'gemini'
 *
 * Guarantees:
 *   - Never throws; always returns ImportedConversation[]
 *   - Silently skips malformed messages
 *   - Logs a warning if top-level structure is unrecognised
 */

import { createHash } from 'crypto';
import type { ImportedConversation, ImportedMessage } from '../types';

// ---------------------------------------------------------------------------
// Internal raw-type shapes (Gemini Takeout)
// ---------------------------------------------------------------------------

interface RawGeminiMessage {
  author?: unknown;
  content?: unknown;
}

interface RawGeminiConversation {
  id?: unknown;
  createTime?: unknown;
  messages?: unknown;
}

interface RawGeminiExportItem {
  title?: unknown;
  conversations?: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseTimestamp(raw: unknown): number {
  if (typeof raw === 'number' && raw > 0) {
    // Gemini Takeout uses seconds-since-epoch for createTime
    return raw > 1e10 ? raw : raw * 1000; // normalise to ms
  }
  if (typeof raw === 'string' && raw.length > 0) {
    const ms = Date.parse(raw);
    if (!isNaN(ms)) return ms;
  }
  return Date.now();
}

function sha256First200(text: string): string {
  return createHash('sha256').update(text.slice(0, 200)).digest('hex');
}

function mapRole(author: unknown): 'user' | 'assistant' | null {
  if (typeof author !== 'string') return null;
  const a = author.toLowerCase().trim();
  if (a === 'user') return 'user';
  if (a === 'model' || a === 'assistant') return 'assistant';
  return null; // skip unknown roles (e.g. 'system', 'tool')
}

// ---------------------------------------------------------------------------
// Per-conversation parser
// ---------------------------------------------------------------------------

function parseConversation(
  raw: RawGeminiConversation,
  title: string,
): ImportedConversation | null {
  if (!raw || typeof raw !== 'object') return null;

  const messages: ImportedMessage[] = [];
  const rawMessages = Array.isArray(raw.messages) ? raw.messages : [];

  for (const m of rawMessages as RawGeminiMessage[]) {
    if (!m || typeof m !== 'object') continue;

    const role = mapRole(m.author);
    if (!role) continue;

    const content =
      typeof m.content === 'string' ? m.content.trim() : '';
    if (content.length === 0) continue;

    const ts = parseTimestamp(raw.createTime); // message-level ts not provided in Takeout

    messages.push({ role, content, created_at: ts });
  }

  if (messages.length === 0) return null;

  const externalId =
    typeof raw.id === 'string' && raw.id.length > 0
      ? raw.id
      : sha256First200(messages[0]?.content ?? title);

  return {
    external_id: externalId,
    title: title || 'Gemini Conversation',
    source_platform: 'gemini',
    created_at: parseTimestamp(raw.createTime),
    messages,
  };
}

// ---------------------------------------------------------------------------
// Top-level validator
// ---------------------------------------------------------------------------

function isGeminiExportArray(parsed: unknown): parsed is RawGeminiExportItem[] {
  if (!Array.isArray(parsed) || parsed.length === 0) return false;
  // At least one item must have a 'conversations' array
  return parsed.some(
    (item) =>
      item !== null &&
      typeof item === 'object' &&
      Array.isArray((item as Record<string, unknown>).conversations),
  );
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function parseGeminiExport(content: unknown): ImportedConversation[] {
  let parsed: unknown;

  if (typeof content === 'string') {
    try {
      parsed = JSON.parse(content);
    } catch {
      console.warn('[gemini adapter] JSON parse failed — skipping');
      return [];
    }
  } else {
    parsed = content;
  }

  if (!isGeminiExportArray(parsed)) {
    console.warn('[gemini adapter] Unrecognized Gemini format, skipping');
    return [];
  }

  const results: ImportedConversation[] = [];

  for (const exportItem of parsed) {
    if (!exportItem || typeof exportItem !== 'object') continue;

    const title =
      typeof exportItem.title === 'string' ? exportItem.title.trim() : '';

    const rawConvos = Array.isArray(exportItem.conversations)
      ? exportItem.conversations
      : [];

    for (const rawConvo of rawConvos as RawGeminiConversation[]) {
      const conv = parseConversation(rawConvo, title);
      if (conv) results.push(conv);
    }
  }

  return results;
}
