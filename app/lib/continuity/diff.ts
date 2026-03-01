import type { Message } from '@/lib/kernl/types';
import type { ConversationDiff, DiffMessage } from './types';

/**
 * Compute a minimal diff between the previous known message set and the current one.
 * Returns only messages that are new (not present in previousIds).
 */
export function computeDiff(
  threadId: string,
  currentMessages: Message[],
  previousIds: Set<string>
): ConversationDiff {
  const addedMessages: DiffMessage[] = currentMessages
    .filter((m) => !previousIds.has(m.id))
    .map((m) => {
      const totalTokens = (m.input_tokens ?? 0) + (m.output_tokens ?? 0);
      const msg: DiffMessage = {
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: m.created_at,
      };
      if (totalTokens > 0) msg.tokens = totalTokens;
      return msg;
    });

  return {
    threadId,
    timestamp: Date.now(),
    addedMessages,
    updatedMetadata: {
      lastActive: Date.now(),
    },
  };
}

/**
 * Extract all message IDs from a set of diffs (for next diff computation).
 */
export function extractKnownIds(diffs: ConversationDiff[]): Set<string> {
  const ids = new Set<string>();
  for (const diff of diffs) {
    for (const m of diff.addedMessages) {
      ids.add(m.id);
    }
  }
  return ids;
}

/**
 * Reconstruct full message list by replaying diffs in order.
 */
export function replayDiffs(diffs: ConversationDiff[]): DiffMessage[] {
  const seen = new Set<string>();
  const messages: DiffMessage[] = [];

  // Sort by timestamp ascending before replaying
  const sorted = [...diffs].sort((a, b) => a.timestamp - b.timestamp);

  for (const diff of sorted) {
    for (const m of diff.addedMessages) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        messages.push(m);
      }
    }
  }

  // Sort final messages by timestamp
  return messages.sort((a, b) => a.timestamp - b.timestamp);
}
