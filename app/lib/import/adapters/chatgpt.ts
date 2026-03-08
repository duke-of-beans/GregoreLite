/**
 * Format Adapter — ChatGPT Export
 * Sprint 33.0 / EPIC-81
 *
 * Parses conversations.json from ChatGPT's data export (Settings → Data Controls → Export).
 * Expected schema:
 *   [ { id, title, create_time, mapping: { [nodeId]: { message?, parent?, children? } } } ]
 *
 * Walks mapping tree from root to reconstruct message order.
 * Only includes 'user' and 'assistant' roles; skips 'system' and 'tool'.
 * Joins content parts (string elements) with newline.
 * Never throws — returns [] on bad input.
 */

import type { ImportedConversation, ImportedMessage } from '../types';

interface RawChatGPTMessage {
  id?: string;
  author?: { role?: string };
  content?: { content_type?: string; parts?: unknown[] };
  create_time?: number | null;
  children?: string[];
}

interface RawChatGPTNode {
  message?: RawChatGPTMessage;
  parent?: string | null;
  children?: string[];
}

interface RawChatGPTConversation {
  id?: string;
  title?: string;
  create_time?: number | null;
  mapping?: Record<string, RawChatGPTNode>;
}

/**
 * Walk the mapping tree from the root node (no parent or parent not in map),
 * following children arrays to reconstruct chronological message order.
 */
function walkMapping(mapping: Record<string, RawChatGPTNode>): RawChatGPTMessage[] {
  const allIds = new Set(Object.keys(mapping));

  // Find root: node whose parent is absent or not in the mapping
  let rootId: string | null = null;
  for (const [id, node] of Object.entries(mapping)) {
    if (!node.parent || !allIds.has(node.parent)) {
      rootId = id;
      break;
    }
  }
  if (!rootId) return [];

  const ordered: RawChatGPTMessage[] = [];
  const queue: string[] = [rootId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = mapping[id];
    if (!node) continue;

    const msg = node.message;
    if (msg) {
      const role = msg.author?.role;
      if ((role === 'user' || role === 'assistant') && msg.content?.parts) {
        ordered.push(msg);
      }
    }

    // Enqueue children in order (children on node or on message)
    const children: string[] = node.children ?? msg?.children ?? [];
    queue.push(...children);
  }

  return ordered;
}

export function parseChatGptExport(data: unknown): ImportedConversation[] {
  if (!Array.isArray(data)) return [];

  const result: ImportedConversation[] = [];

  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const conv = item as RawChatGPTConversation;
    if (!conv.id || !conv.mapping || typeof conv.mapping !== 'object') continue;

    const orderedMsgs = walkMapping(conv.mapping);

    const messages: ImportedMessage[] = orderedMsgs
      .map((m): ImportedMessage => {
        const parts = m.content?.parts ?? [];
        const content = parts
          .filter((p): p is string => typeof p === 'string')
          .join('\n')
          .trim();
        return {
          role: (m.author?.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content,
          created_at:
            typeof m.create_time === 'number'
              ? Math.round(m.create_time * 1000)
              : Date.now(),
        };
      })
      .filter((m) => m.content.length > 0);

    result.push({
      external_id: conv.id,
      source_platform: 'chatgpt',
      title: conv.title ?? conv.id,
      created_at:
        typeof conv.create_time === 'number'
          ? Math.round(conv.create_time * 1000)
          : Date.now(),
      messages,
    });
  }

  return result;
}
