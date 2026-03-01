import { getDatabase } from '@/lib/kernl/database';
import {
  getThreadMessages,
  listThreads,
} from '@/lib/kernl/session-manager';
import { computeDiff, replayDiffs } from './diff';
import type { ConversationDiff, RestoredConversation } from './types';

// In-memory cache: threadId → Set of already-checkpointed message IDs
// Reset on process restart (that's the point — we recompute from DB on restore)
const _checkpointedIds = new Map<string, Set<string>>();

/**
 * Write a diff checkpoint after every assistant response.
 * Stores only new messages since last checkpoint — not the full dump.
 * Must complete in <50ms (synchronous SQLite write).
 */
export function checkpoint(threadId: string, lastMessageId?: string): void {
  const start = Date.now();

  const currentMessages = getThreadMessages(threadId);
  const previousIds = _checkpointedIds.get(threadId) ?? new Set<string>();

  const diff = computeDiff(threadId, currentMessages, previousIds);

  // Only write if there's something new
  if (diff.addedMessages.length === 0) return;

  const db = getDatabase();
  const id = `cp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  db.prepare(`
    INSERT INTO checkpoints (id, thread_id, message_id, snapshot, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    id,
    threadId,
    lastMessageId ?? null,
    JSON.stringify(diff),
    Date.now()
  );

  // Update known IDs cache
  const updatedIds = new Set(previousIds);
  for (const m of diff.addedMessages) {
    updatedIds.add(m.id);
  }
  _checkpointedIds.set(threadId, updatedIds);

  const elapsed = Date.now() - start;
  if (elapsed > 50) {
    console.warn(`[continuity] Checkpoint write took ${elapsed}ms (target <50ms)`);
  }
}

/**
 * Restore a conversation from its diffs on boot.
 * Replays all stored diffs in order to reconstruct message history.
 */
export function restore(threadId: string): RestoredConversation | null {
  const db = getDatabase();

  const rows = db.prepare(
    'SELECT snapshot FROM checkpoints WHERE thread_id = ? ORDER BY created_at ASC'
  ).all(threadId) as Array<{ snapshot: string }>;

  if (rows.length === 0) return null;

  const diffs: ConversationDiff[] = [];
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.snapshot) as ConversationDiff;
      // Only process records that have the diff format (addedMessages field)
      if (parsed.addedMessages) {
        diffs.push(parsed);
      }
    } catch {
      // Skip malformed snapshots
    }
  }

  if (diffs.length === 0) return null;

  const messages = replayDiffs(diffs);
  const lastActive = diffs[diffs.length - 1]?.updatedMetadata?.lastActive ?? Date.now();

  // Seed the in-memory cache so the next checkpoint only diffs against these
  const knownIds = new Set(messages.map((m) => m.id));
  _checkpointedIds.set(threadId, knownIds);

  return {
    threadId,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    })),
    lastActive,
  };
}

/**
 * Returns the thread ID of the most recently active session.
 * Used on boot to auto-restore the last conversation.
 */
export function getLastActiveThread(): string | null {
  const threads = listThreads(1);
  return threads[0]?.id ?? null;
}
