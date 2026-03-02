/**
 * Ghost Scorer — Ranking Formula
 *
 * scoreCandidate() applies the BLUEPRINT §6.4 Ghost ranking formula:
 *
 *   score = similarity × recency_boost × relevance_boost
 *           × (1 − dismissal_penalty) × importance_boost
 *
 * recency_boost:
 *   1.0   if indexed within last 7 days
 *   linear decay 1.0 → 0.5 between 7 and 90 days
 *   0.5   if older than 90 days
 *
 * relevance_boost:
 *   1.2   if source_path is within an active KERNL project directory
 *   1.0   otherwise
 *
 * dismissal_penalty:
 *   0.2 × (dismissals in last 30 days for this source path)
 *   capped at 0.8 (score never drops below 20% of base)
 *
 * importance_boost:
 *   1.5   if chunk's ghost_indexed_items.critical = 1
 *   1.0   otherwise
 */

import { getDatabase } from '@/lib/kernl/database';
import type { GhostCandidate } from './types';

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVEN_DAYS_MS   = 7  * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS  = 90 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS  = 30 * 24 * 60 * 60 * 1000;

// ─── Component functions (exported for unit testing) ─────────────────────────

/**
 * Recency boost: 1.0 within 7 days, linear decay to 0.5 at 90 days, 0.5 beyond.
 */
export function computeRecencyBoost(indexedAt: number, now: number = Date.now()): number {
  const age = now - indexedAt;
  if (age <= SEVEN_DAYS_MS) return 1.0;
  if (age >= NINETY_DAYS_MS) return 0.5;
  // Linear interpolation: t=0 at 7 days → boost=1.0, t=1 at 90 days → boost=0.5
  const t = (age - SEVEN_DAYS_MS) / (NINETY_DAYS_MS - SEVEN_DAYS_MS);
  return 1.0 - t * 0.5;
}

/**
 * Relevance boost: 1.2 if source_path is under an active project directory.
 */
export function computeRelevanceBoost(sourcePath: string | null): number {
  if (!sourcePath) return 1.0;
  const db = getDatabase();
  const projects = db
    .prepare(`SELECT path FROM projects WHERE status = 'active' AND path IS NOT NULL`)
    .all() as Array<{ path: string }>;

  for (const project of projects) {
    // Normalise separators so Windows and POSIX paths both match
    const normSource = sourcePath.replace(/\\/g, '/');
    const normProject = project.path.replace(/\\/g, '/');
    if (normSource.startsWith(normProject)) return 1.2;
  }
  return 1.0;
}

/**
 * Dismissal penalty: 0.2 per dismissal in last 30 days for this source path.
 * Capped at 0.8 so the score never drops to zero from dismissals alone.
 */
export function computeDismissalPenalty(sourcePath: string | null): number {
  if (!sourcePath) return 0;
  const db = getDatabase();
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  const result = db
    .prepare(
      `SELECT COUNT(*) as count FROM ghost_suggestion_feedback
       WHERE source_path = ? AND action = 'dismissed' AND logged_at >= ?`
    )
    .get(sourcePath, cutoff) as { count: number } | undefined;

  const dismissals = result?.count ?? 0;
  return Math.min(0.2 * dismissals, 0.8);
}

// ─── Main scoring function ────────────────────────────────────────────────────

/**
 * Apply the full BLUEPRINT §6.4 ranking formula to a single candidate.
 * All component boosts use synchronous better-sqlite3 calls.
 */
export function scoreCandidate(candidate: GhostCandidate, now: number = Date.now()): number {
  const recencyBoost     = computeRecencyBoost(candidate.indexedAt, now);
  const relevanceBoost   = computeRelevanceBoost(candidate.sourcePath);
  const dismissalPenalty = computeDismissalPenalty(candidate.sourcePath);
  const importanceBoost  = candidate.isCritical ? 1.5 : 1.0;

  return (
    candidate.similarity *
    recencyBoost *
    relevanceBoost *
    (1 - dismissalPenalty) *
    importanceBoost
  );
}
