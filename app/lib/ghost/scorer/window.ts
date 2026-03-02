/**
 * Ghost Scorer — 24-Hour Rolling Window
 *
 * Enforces the hard cap of 2 surfaced suggestions per 24-hour window.
 * Critical suggestions (similarity > 0.95 AND importanceBoost > 1.3) can
 * bypass the cap via criticalOverride().
 *
 * ghost_surfaced rows are never deleted — expired rows are ignored by
 * canSurface() (they fall outside the 24h window). Dismissed rows still
 * count toward the cap within the window (they already disturbed the user).
 */

import { nanoid } from 'nanoid';
import { getDatabase } from '@/lib/kernl/database';
import type { GhostSuggestion } from './types';

// ─── Row shapes ───────────────────────────────────────────────────────────────

interface SurfacedCountRow {
  count: number;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns true if a new suggestion can be surfaced under the rolling cap.
 * Counts all suggestions surfaced within the window — including dismissed.
 */
export async function canSurface(
  maxPerWindow: number = 2,
  windowMs: number = 24 * 60 * 60 * 1000
): Promise<boolean> {
  const db = getDatabase();
  const cutoff = Date.now() - windowMs;
  const result = db
    .prepare(`SELECT COUNT(*) as count FROM ghost_surfaced WHERE surfaced_at >= ?`)
    .get(cutoff) as SurfacedCountRow | undefined;

  return (result?.count ?? 0) < maxPerWindow;
}

/**
 * Persist a surfaced suggestion to the rolling window table.
 */
export async function recordSurfaced(suggestion: GhostSuggestion): Promise<void> {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO ghost_surfaced (id, chunk_id, score, surfaced_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(suggestion.id, suggestion.chunkId, suggestion.score, suggestion.surfacedAt, suggestion.expiresAt);
}

/**
 * Mark a surfaced suggestion as dismissed.
 */
export async function dismissSurfaced(id: string): Promise<void> {
  const db = getDatabase();
  db.prepare(`UPDATE ghost_surfaced SET dismissed_at = ? WHERE id = ?`).run(Date.now(), id);
}

/**
 * Critical override: bypass the 24h cap when both conditions are met.
 *   similarity > 0.95   (extremely high signal relevance)
 *   importanceBoost > 1.3 (chunk is marked critical by user)
 */
export function criticalOverride(similarity: number, importanceBoost: number): boolean {
  return similarity > 0.95 && importanceBoost > 1.3;
}

/** Generate a new suggestion ID (exposed for testing). */
export function newSuggestionId(): string {
  return nanoid();
}
