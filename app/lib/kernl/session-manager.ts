import { nanoid } from 'nanoid';
import { getDatabase } from './database';
import type { Thread, Message, CreateThreadInput, CreateMessageInput } from './types';

// ─── Thread operations ───────────────────────────────────────────────────────

export function createThread(input: CreateThreadInput): Thread {
  const db = getDatabase();
  const id = nanoid();
  const now = Date.now();
  const meta = input.meta ? JSON.stringify(input.meta) : null;

  db.prepare(`
    INSERT INTO threads (id, title, project_id, created_at, updated_at, meta)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, input.title, input.project_id ?? null, now, now, meta);

  return getThread(id)!;
}

export function getThread(id: string): Thread | null {
  const db = getDatabase();
  return (db.prepare('SELECT * FROM threads WHERE id = ?').get(id) as Thread) ?? null;
}

export function listThreads(limit = 50): Thread[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM threads ORDER BY updated_at DESC LIMIT ?').all(limit) as Thread[];
}

export function updateThreadTitle(id: string, title: string): void {
  const db = getDatabase();
  db.prepare('UPDATE threads SET title = ?, updated_at = ? WHERE id = ?')
    .run(title, Date.now(), id);
}

export function deleteThread(id: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM threads WHERE id = ?').run(id);
}

// ─── Message operations ──────────────────────────────────────────────────────

export function addMessage(input: CreateMessageInput): Message {
  const db = getDatabase();
  const id = nanoid();
  const now = Date.now();
  const meta = input.meta ? JSON.stringify(input.meta) : null;

  db.prepare(`
    INSERT INTO messages (id, thread_id, role, content, model, input_tokens, output_tokens, cost_usd, latency_ms, created_at, meta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.thread_id,
    input.role,
    input.content,
    input.model ?? null,
    input.input_tokens ?? 0,
    input.output_tokens ?? 0,
    input.cost_usd ?? 0,
    input.latency_ms ?? 0,
    now,
    meta,
  );

  // Touch thread updated_at
  db.prepare('UPDATE threads SET updated_at = ? WHERE id = ?').run(now, input.thread_id);

  return getMessage(id)!;
}

export function getMessage(id: string): Message | null {
  const db = getDatabase();
  return (db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Message) ?? null;
}

export function getThreadMessages(threadId: string): Message[] {
  const db = getDatabase();
  return db.prepare(
    'SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC'
  ).all(threadId) as Message[];
}

export function getLastNMessages(threadId: string, n: number): Message[] {
  const db = getDatabase();
  // Get last N in reverse then re-sort ascending
  const rows = db.prepare(
    'SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(threadId, n) as Message[];
  return rows.reverse();
}

// ─── Search ──────────────────────────────────────────────────────────────────

export function searchMessages(query: string, limit = 20): Message[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT m.* FROM messages m
    JOIN messages_fts f ON m.rowid = f.rowid
    WHERE messages_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `).all(query, limit) as Message[];
}
