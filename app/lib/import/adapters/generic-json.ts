/**
 * Format Adapter — Generic JSON Fallback
 * Sprint 33.0 / EPIC-81
 *
 * Best-effort parser for any recognisable conversation JSON.
 * Handles two shapes:
 *   A) Array of conversation objects with a 'messages' array
 *   B) Flat array of message objects (role + content) → treated as one conversation
 *
 * Returns [] if the input is unrecognisable. Never throws.
 */

import type { ImportedConversation, ImportedMessage } from '../types';

type UnknownRecord = Record<string, unknown>;

function toRole(raw: unknown): 'user' | 'assistant' {
  const r = String(raw ?? 'user').toLowerCase();
  return r === 'assistant' || r === 'ai' || r === 'bot' ? 'assistant' : 'user';
}

function extractContent(obj: UnknownRecord): string {
  return String(obj['content'] ?? obj['text'] ?? obj['message'] ?? '').trim();
}

export function parseGenericJson(data: unknown): ImportedConversation[] {
  if (!Array.isArray(data) || data.length === 0) return [];

  const result: ImportedConversation[] = [];
  const first = data[0];
  if (!first || typeof first !== 'object') return [];
  const firstObj = first as UnknownRecord;

  // ── Shape A: array of conversation objects each with a 'messages' array ──────
  if (Array.isArray(firstObj['messages'])) {
    for (const item of data) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as UnknownRecord;
      const rawMessages = obj['messages'];
      if (!Array.isArray(rawMessages)) continue;

      const messages: ImportedMessage[] = rawMessages
        .filter((m): m is UnknownRecord => !!m && typeof m === 'object')
        .map((m) => ({
          role: toRole(m['role']),
          content: extractContent(m),
          created_at:
            typeof m['created_at'] === 'number' ? m['created_at'] : Date.now(),
        }))
        .filter((m) => m.content.length > 0);

      if (messages.length === 0) continue;

      result.push({
        external_id: String(obj['id'] ?? obj['uuid'] ?? `generic_${result.length}`),
        source_platform: 'generic',
        title: String(obj['title'] ?? obj['name'] ?? `Conversation ${result.length + 1}`),
        created_at:
          typeof obj['created_at'] === 'number' ? obj['created_at'] : Date.now(),
        messages,
      });
    }
    return result;
  }

  // ── Shape B: flat array of message objects → single conversation ─────────────
  if (firstObj['role'] !== undefined) {
    const messages: ImportedMessage[] = data
      .filter((m): m is UnknownRecord => !!m && typeof m === 'object')
      .map((m) => ({
        role: toRole(m['role']),
        content: extractContent(m),
        created_at:
          typeof m['created_at'] === 'number' ? m['created_at'] : Date.now(),
      }))
      .filter((m) => m.content.length > 0);

    if (messages.length > 0) {
      result.push({
        external_id: 'generic_flat_0',
        source_platform: 'generic',
        title: 'Imported Conversation',
        created_at: Date.now(),
        messages,
      });
    }
    return result;
  }

  return [];
}
