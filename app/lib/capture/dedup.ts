/**
 * Capture Dedup — Sprint 29.0
 *
 * Semantic deduplication for capture notes.
 * Three-tier strategy — stops at first match, never blocks capture.
 *
 * Tier 1: Exact match (normalize whitespace + lowercase)
 * Tier 2: Token overlap (Jaccard similarity > 0.7)
 * Tier 3: Embedding cosine similarity (> 0.85, only if model is available)
 *
 * If a duplicate is found: increment mention_count, update last_mentioned_at
 * on the existing note, and store the new note with merged_with set.
 */

import type { CaptureNote } from './types';
import { getDatabase } from '@/lib/kernl/database';

export interface DedupResult {
  isDuplicate: boolean;
  existingNote: CaptureNote | null;
  similarity: number;
}

// ── Tier 1: Exact match ───────────────────────────────────────────────────────

function normalizeBody(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function exactMatch(newBody: string, candidates: CaptureNote[]): CaptureNote | null {
  const norm = normalizeBody(newBody);
  return candidates.find((n) => normalizeBody(n.parsed_body) === norm) ?? null;
}

// ── Tier 2: Token overlap (Jaccard) ──────────────────────────────────────────

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  let intersect = 0;
  for (const token of a) {
    if (b.has(token)) intersect++;
  }
  const union = a.size + b.size - intersect;
  return intersect / union;
}

function tokenMatch(
  newBody: string,
  candidates: CaptureNote[],
  threshold = 0.7
): { note: CaptureNote; similarity: number } | null {
  const newTokens = tokenize(newBody);
  let best: { note: CaptureNote; similarity: number } | null = null;

  for (const candidate of candidates) {
    const sim = jaccardSimilarity(newTokens, tokenize(candidate.parsed_body));
    if (sim >= threshold && (!best || sim > best.similarity)) {
      best = { note: candidate, similarity: sim };
    }
  }
  return best;
}

// ── Tier 3: Embedding cosine similarity ──────────────────────────────────────

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

async function embeddingMatch(
  newBody: string,
  candidates: CaptureNote[],
  threshold = 0.85
): Promise<{ note: CaptureNote; similarity: number } | null> {
  try {
    const { embedText } = await import('@/lib/embeddings/model');
    const newVec = await embedText(newBody);
    let best: { note: CaptureNote; similarity: number } | null = null;

    for (const candidate of candidates) {
      const candVec = await embedText(candidate.parsed_body);
      const sim = cosineSimilarity(newVec, candVec);
      if (sim >= threshold && (!best || sim > best.similarity)) {
        best = { note: candidate, similarity: sim };
      }
    }
    return best;
  } catch {
    // Embedding model unavailable (downloading, ONNX runtime missing, etc.)
    // Dedup MUST never block capture — fall through silently.
    return null;
  }
}

// ── Exported API ──────────────────────────────────────────────────────────────

/**
 * Check if a new note is a duplicate of an existing inbox note for the same project.
 * Runs through the three tiers in order; stops at first match.
 * Never throws — returns isDuplicate: false on any unexpected error.
 */
export async function findDuplicate(
  newBody: string,
  projectId: string | null
): Promise<DedupResult> {
  try {
    const db = getDatabase();

    // Fetch existing inbox notes for this project (or all unrouted if projectId null)
    const candidates = (
      projectId !== null
        ? db
            .prepare(
              `SELECT * FROM capture_notes WHERE project_id = ? AND status = 'inbox' AND merged_with IS NULL`
            )
            .all(projectId)
        : db
            .prepare(
              `SELECT * FROM capture_notes WHERE project_id IS NULL AND status = 'inbox' AND merged_with IS NULL`
            )
            .all()
    ) as CaptureNote[];

    if (candidates.length === 0) return { isDuplicate: false, existingNote: null, similarity: 0 };

    // Tier 1: exact
    const exact = exactMatch(newBody, candidates);
    if (exact) return { isDuplicate: true, existingNote: exact, similarity: 1 };

    // Tier 2: token overlap
    const token = tokenMatch(newBody, candidates, 0.7);
    if (token) return { isDuplicate: true, existingNote: token.note, similarity: token.similarity };

    // Tier 3: embedding (async, may fail gracefully)
    const embedding = await embeddingMatch(newBody, candidates, 0.85);
    if (embedding) return { isDuplicate: true, existingNote: embedding.note, similarity: embedding.similarity };

    return { isDuplicate: false, existingNote: null, similarity: 0 };
  } catch {
    // Never block capture
    return { isDuplicate: false, existingNote: null, similarity: 0 };
  }
}

/**
 * Merge a new note into an existing primary note.
 * Increments mention_count and updates last_mentioned_at on the primary.
 * Returns the updated primary note.
 */
export function mergeIntoPrimary(
  primaryId: string,
  mergedNoteId: string
): CaptureNote | null {
  try {
    const db = getDatabase();
    const now = Date.now();

    db.prepare(
      `UPDATE capture_notes SET mention_count = mention_count + 1, last_mentioned_at = ? WHERE id = ?`
    ).run(now, primaryId);

    db.prepare(
      `UPDATE capture_notes SET merged_with = ?, last_mentioned_at = ? WHERE id = ?`
    ).run(primaryId, now, mergedNoteId);

    return db.prepare(`SELECT * FROM capture_notes WHERE id = ?`).get(primaryId) as CaptureNote | null;
  } catch {
    return null;
  }
}
