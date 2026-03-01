import { nanoid } from 'nanoid';
import { getDatabase } from './database';
import { getThreadMessages } from './session-manager';
import type { Checkpoint, CreateCheckpointInput, Message } from './types';

/**
 * Write a checkpoint snapshot of the current thread state.
 * Called after every assistant response for crash recovery.
 */
export function writeCheckpoint(input: CreateCheckpointInput): Checkpoint {
  const db = getDatabase();
  const id = nanoid();
  const now = Date.now();

  const snapshot = JSON.stringify(input.snapshot);

  db.prepare(`
    INSERT INTO checkpoints (id, thread_id, message_id, snapshot, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, input.thread_id, input.message_id ?? null, snapshot, now);

  return getCheckpoint(id)!;
}

export function getCheckpoint(id: string): Checkpoint | null {
  const db = getDatabase();
  return (db.prepare('SELECT * FROM checkpoints WHERE id = ?').get(id) as Checkpoint) ?? null;
}

/**
 * Get the most recent checkpoint for a thread.
 */
export function getLatestCheckpoint(threadId: string): Checkpoint | null {
  const db = getDatabase();
  return (db.prepare(`
    SELECT * FROM checkpoints WHERE thread_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(threadId) as Checkpoint) ?? null;
}

/**
 * Restore thread messages from the latest checkpoint snapshot.
 * Returns null if no checkpoint exists.
 */
export function restoreFromCheckpoint(threadId: string): Message[] | null {
  const checkpoint = getLatestCheckpoint(threadId);
  if (!checkpoint) return null;

  try {
    const messages = JSON.parse(checkpoint.snapshot) as Message[];
    return Array.isArray(messages) ? messages : null;
  } catch {
    return null;
  }
}

/**
 * Write a checkpoint capturing the full current thread message history.
 * Convenience wrapper — call this after each assistant response.
 */
export function checkpointThread(threadId: string, lastMessageId?: string): Checkpoint {
  const messages = getThreadMessages(threadId);
  return writeCheckpoint({
    thread_id: threadId,
    ...(lastMessageId !== undefined && { message_id: lastMessageId }),
    snapshot: messages,
  });
}

/**
 * Prune old checkpoints, keeping only the N most recent per thread.
 */
export function pruneCheckpoints(threadId: string, keepLatest = 10): void {
  const db = getDatabase();
  db.prepare(`
    DELETE FROM checkpoints
    WHERE thread_id = ?
      AND id NOT IN (
        SELECT id FROM checkpoints
        WHERE thread_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      )
  `).run(threadId, threadId, keepLatest);
}
