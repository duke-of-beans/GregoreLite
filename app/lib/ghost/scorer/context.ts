/**
 * Ghost Scorer — Active Context Signal
 *
 * buildActiveContextVector() — embed the current working context into a
 * Float32Array for use as the similarity query in the interrupt scorer.
 *
 * The context signal is assembled from:
 *   1. Last 5 assistant messages from the most recently active thread
 *   2. Active Agent SDK manifest title + description (if a job is running)
 *   3. Current project name (if the thread is linked to a project)
 *
 * Returns null when there is no active session — scorer will not run.
 *
 * buildContextSummary() — plain-text version of the context signal (≤200 chars)
 * used as the Haiku prompt context for summary generation.
 */

import { getDatabase } from '@/lib/kernl/database';

// ─── Row shapes ───────────────────────────────────────────────────────────────

interface ThreadRow {
  id: string;
  project_id: string | null;
}

interface MessageRow {
  content: string;
}

interface ManifestRow {
  title: string | null;
  description: string | null;
}

interface ProjectRow {
  name: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Assemble the active context string and embed it.
 * Returns null when GregLite is idle (no messages in any thread).
 */
export async function buildActiveContextVector(): Promise<Float32Array | null> {
  const db = getDatabase();

  // Most recently active thread (has at least one message)
  const thread = db
    .prepare(
      `SELECT t.id, t.project_id FROM threads t
       INNER JOIN messages m ON m.thread_id = t.id
       ORDER BY t.updated_at DESC
       LIMIT 1`
    )
    .get() as ThreadRow | undefined;

  if (!thread) return null;

  // Last 5 assistant messages (oldest-first for readable context)
  const messages = db
    .prepare(
      `SELECT content FROM messages
       WHERE thread_id = ? AND role = 'assistant'
       ORDER BY created_at DESC
       LIMIT 5`
    )
    .all(thread.id) as MessageRow[];

  if (messages.length === 0) return null;

  const parts: string[] = messages.map((m) => m.content).reverse();

  // Active manifest task description
  const manifest = db
    .prepare(
      `SELECT title, description FROM manifests
       WHERE status IN ('running', 'working')
       ORDER BY updated_at DESC
       LIMIT 1`
    )
    .get() as ManifestRow | undefined;

  if (manifest) {
    const desc = [manifest.title, manifest.description].filter(Boolean).join(' — ');
    if (desc) parts.push(`Active task: ${desc}`);
  }

  // Project name (if thread is linked to a project)
  if (thread.project_id) {
    const project = db
      .prepare(`SELECT name FROM projects WHERE id = ?`)
      .get(thread.project_id) as ProjectRow | undefined;
    if (project) parts.push(`Project: ${project.name}`);
  }

  const contextText = parts.join('\n\n');

  // Dynamic import breaks circular dep: scorer → embeddings → vector → scorer
  const { embedText } = await import('@/lib/embeddings/model');
  return embedText(contextText);
}

/**
 * Plain-text summary of the active context for use in Haiku prompts.
 * Returns the most recent assistant message truncated to 200 chars,
 * or a fallback string if no session is active.
 */
export function buildContextSummary(): string {
  const db = getDatabase();

  const thread = db
    .prepare(
      `SELECT t.id FROM threads t
       INNER JOIN messages m ON m.thread_id = t.id
       ORDER BY t.updated_at DESC
       LIMIT 1`
    )
    .get() as { id: string } | undefined;

  if (!thread) return 'no active session';

  const message = db
    .prepare(
      `SELECT content FROM messages
       WHERE thread_id = ? AND role = 'assistant'
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(thread.id) as MessageRow | undefined;

  return message ? message.content.slice(0, 200) : 'active session';
}
