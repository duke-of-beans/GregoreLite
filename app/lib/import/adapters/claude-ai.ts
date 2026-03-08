/**
 * Format Adapter — claude.ai Export
 * Sprint 33.0 / EPIC-81
 *
 * Parses the JSON array produced by claude.ai Settings → Export data.
 * Expected schema:
 *   [ { uuid, name, created_at, chat_messages: [{ uuid, sender, text, created_at }] } ]
 *
 * sender 'human' → role 'user'; all others → role 'assistant'.
 * Never throws — returns [] on bad input.
 */

import type { ImportedConversation, ImportedMessage } from '../types';

interface RawClaudeMessage {
  uuid?: string;
  sender?: string;
  text?: string;
  created_at?: string | number;
}

interface RawClaudeConversation {
  uuid?: string;
  name?: string;
  created_at?: string | number;
  chat_messages?: RawClaudeMessage[];
}

function parseTimestamp(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.length > 0) {
    const ms = Date.parse(value);
    if (!isNaN(ms)) return ms;
  }
  return Date.now();
}

export function parseClaudeAiExport(data: unknown): ImportedConversation[] {
  if (!Array.isArray(data)) return [];

  const result: ImportedConversation[] = [];

  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const conv = item as RawClaudeConversation;
    if (!conv.uuid || !Array.isArray(conv.chat_messages)) continue;

    const messages: ImportedMessage[] = conv.chat_messages
      .filter((m): m is RawClaudeMessage => !!m && typeof m === 'object' && !!m.text)
      .map((m) => ({
        role: (m.sender === 'human' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: String(m.text ?? '').trim(),
        created_at: parseTimestamp(m.created_at),
      }))
      .filter((m) => m.content.length > 0);

    result.push({
      external_id: conv.uuid,
      source_platform: 'claude_ai',
      title: conv.name ?? conv.uuid,
      created_at: parseTimestamp(conv.created_at),
      messages,
    });
  }

  return result;
}
