import { nanoid } from 'nanoid';
import { getDatabase } from './database';
import type { Decision, CreateDecisionInput } from './types';

export function logDecision(input: CreateDecisionInput): Decision {
  const db = getDatabase();
  const id = nanoid();
  const now = Date.now();

  const alternatives = input.alternatives ? JSON.stringify(input.alternatives) : null;
  const meta = input.meta ? JSON.stringify(input.meta) : null;

  db.prepare(`
    INSERT INTO decisions (id, thread_id, category, title, rationale, alternatives, impact, created_at, meta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.thread_id ?? null,
    input.category,
    input.title,
    input.rationale,
    alternatives,
    input.impact ?? null,
    now,
    meta,
  );

  return getDecision(id)!;
}

export function getDecision(id: string): Decision | null {
  const db = getDatabase();
  return (db.prepare('SELECT * FROM decisions WHERE id = ?').get(id) as Decision) ?? null;
}

export function listDecisions(opts: {
  category?: string;
  threadId?: string;
  limit?: number;
} = {}): Decision[] {
  const db = getDatabase();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts.category) {
    conditions.push('category = ?');
    params.push(opts.category);
  }
  if (opts.threadId) {
    conditions.push('thread_id = ?');
    params.push(opts.threadId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = opts.limit ?? 100;
  params.push(limit);

  return db.prepare(
    `SELECT * FROM decisions ${where} ORDER BY created_at DESC LIMIT ?`
  ).all(...params) as Decision[];
}

export function getDecisionsByCategory(category: string): Decision[] {
  return listDecisions({ category });
}

export function getDecisionsForThread(threadId: string): Decision[] {
  return listDecisions({ threadId });
}

// Parse alternatives JSON back to string[]
export function parseAlternatives(decision: Decision): string[] {
  if (!decision.alternatives) return [];
  try {
    return JSON.parse(decision.alternatives) as string[];
  } catch {
    return [];
  }
}
