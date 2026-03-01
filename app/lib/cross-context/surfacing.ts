/**
 * Proactive surfacing — ranking, filtering, suppression (Sprint 3E + 3G)
 *
 * Ranking formula (full, Sprint 3G):
 *   score = sim² × recencyFactor × relevanceBoost × (1 − dismissalPenalty) × valueBoost
 *
 * Max 2 suggestions visible. Min display score: 0.70.
 * Suppression: 3 dismissals in 48h → 48h; 5 dismissals in 7 days → 7-day.
 *
 * @module lib/cross-context/surfacing
 */

import { getDatabase } from '@/lib/kernl/database';
import type { VectorSearchResult } from '@/lib/vector/types';
import { getValueBoost } from './value-boost';
import type { Suggestion } from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_SUGGESTIONS = 2;
const MIN_DISPLAY_SCORE = 0.70;

const RECENCY_FULL_DAYS = 7;
const RECENCY_MIN_DAYS = 90;
const RECENCY_MIN_FACTOR = 0.5;

const DISMISSAL_PENALTY_PER = 0.2;
const DISMISSAL_MAX_PENALTY = 0.8;
const DISMISSAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const SUPPRESSION_WINDOW_7D_MS = 7 * 24 * 60 * 60 * 1000;
const SUPPRESSION_WINDOW_48H_MS = 48 * 60 * 60 * 1000;
const SUPPRESSION_5_THRESHOLD = 5;
const SUPPRESSION_3_THRESHOLD = 3;

const RELEVANCE_BOOST_SAME_PROJECT = 1.2;

// ── Recency factor ────────────────────────────────────────────────────────────

/**
 * Returns 1.0 for content ≤7 days old, decaying linearly to 0.5 at 90 days,
 * and clamped at 0.5 for anything older.
 */
export function getRecencyFactor(createdAt: number): number {
  const ageDays = (Date.now() - createdAt) / (24 * 60 * 60 * 1000);
  if (ageDays <= RECENCY_FULL_DAYS) return 1.0;
  if (ageDays >= RECENCY_MIN_DAYS) return RECENCY_MIN_FACTOR;
  const range = RECENCY_MIN_DAYS - RECENCY_FULL_DAYS;
  const excess = ageDays - RECENCY_FULL_DAYS;
  return 1.0 - (excess / range) * (1.0 - RECENCY_MIN_FACTOR);
}

// ── Dismissal helpers ─────────────────────────────────────────────────────────

/** Returns count of dismissals for chunk within a rolling time window. */
export function getDismissalsInWindow(chunkId: string, windowMs: number): number {
  const db = getDatabase();
  const windowStart = Date.now() - windowMs;
  const row = db.prepare(`
    SELECT COUNT(*) as count FROM suggestions
    WHERE chunk_id = ? AND user_action = 'dismissed' AND acted_at > ?
  `).get(chunkId, windowStart) as { count: number };
  return row.count;
}

/** Returns penalty [0.0, 0.8] based on dismissals in last 30 days. */
export function getDismissalPenalty(chunkId: string): number {
  return Math.min(
    getDismissalsInWindow(chunkId, DISMISSAL_WINDOW_MS) * DISMISSAL_PENALTY_PER,
    DISMISSAL_MAX_PENALTY
  );
}

// ── Chunk metadata ────────────────────────────────────────────────────────────

interface ChunkMeta {
  content: string;
  sourceType: string;
  sourceId: string;
  createdAt: number;
  /** project_id resolved via threads join when source_type = 'conversation'; null otherwise */
  projectId: string | null;
}

interface ChunkMetaRow {
  content: string;
  source_type: string;
  source_id: string;
  created_at: number;
  project_id: string | null;
}

/**
 * Fetch chunk metadata with project resolution.
 * When source_type = 'conversation', joins threads to get project_id.
 */
export function getChunkMeta(chunkId: string): ChunkMeta | undefined {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT
      cc.content,
      cc.source_type,
      cc.source_id,
      cc.created_at,
      t.project_id
    FROM content_chunks cc
    LEFT JOIN threads t
      ON cc.source_type = 'conversation' AND cc.source_id = t.id
    WHERE cc.id = ?
  `).get(chunkId) as ChunkMetaRow | undefined;

  if (!row) return undefined;
  return {
    content: row.content,
    sourceType: row.source_type,
    sourceId: row.source_id,
    createdAt: row.created_at,
    projectId: row.project_id ?? null,
  };
}

// ── Suppression ───────────────────────────────────────────────────────────────

/**
 * Check if a chunk is currently suppressed:
 * - 5+ dismissals in last 7 days → 7-day suppression
 * - 3+ dismissals in last 48 hours → 48-hour suppression
 */
export function isSuppressed(chunkId: string): boolean {
  if (getDismissalsInWindow(chunkId, SUPPRESSION_WINDOW_7D_MS) >= SUPPRESSION_5_THRESHOLD) {
    return true;
  }
  if (getDismissalsInWindow(chunkId, SUPPRESSION_WINDOW_48H_MS) >= SUPPRESSION_3_THRESHOLD) {
    return true;
  }
  return false;
}

// ── Full ranking formula (Sprint 3G) ─────────────────────────────────────────

/**
 * Compute full display score for a candidate:
 *   score = sim² × recencyFactor × relevanceBoost × (1 − dismissalPenalty) × valueBoost
 *
 * Returns 0 if the chunk cannot be found in content_chunks.
 */
export function scoreCandidate(
  candidate: VectorSearchResult,
  context: { activeProjectId?: string }
): number {
  const chunk = getChunkMeta(candidate.chunkId);
  if (!chunk) return 0;

  const sim2 = Math.pow(candidate.similarity, 2);
  const recencyFactor = getRecencyFactor(chunk.createdAt);
  const relevanceBoost =
    chunk.projectId !== null && chunk.projectId === context.activeProjectId
      ? RELEVANCE_BOOST_SAME_PROJECT
      : 1.0;
  const dismissalPenalty = getDismissalPenalty(candidate.chunkId);
  const valueBoost = getValueBoost(candidate.chunkId);

  return sim2 * recencyFactor * relevanceBoost * (1 - dismissalPenalty) * valueBoost;
}

// ── Ranking + filter (Sprint 3E — kept for backward compatibility) ────────────

interface LegacyChunkMetaRow {
  content: string;
  source_type: string;
  source_id: string;
  created_at: number;
}

/**
 * Rank and filter vector search candidates using the surfacing formula.
 * Returns at most 2 suggestions with display_score ≥ currentThreshold.
 *
 * @deprecated Prefer scoreCandidate() + proactive.ts checkOnInput() for Sprint 3G+.
 */
export function rankAndFilter(
  candidates: VectorSearchResult[],
  currentThreshold: number
): Suggestion[] {
  const db = getDatabase();
  const scored: Suggestion[] = [];

  for (const candidate of candidates) {
    if (isSuppressed(candidate.chunkId)) continue;

    const chunk = db
      .prepare(
        'SELECT content, source_type, source_id, created_at FROM content_chunks WHERE id = ?'
      )
      .get(candidate.chunkId) as LegacyChunkMetaRow | undefined;
    if (!chunk) continue;

    const recencyFactor = getRecencyFactor(chunk.created_at);
    const dismissalPenalty = getDismissalPenalty(candidate.chunkId);
    const displayScore =
      Math.pow(candidate.similarity, 2) * recencyFactor * (1 - dismissalPenalty);

    if (displayScore >= currentThreshold) {
      scored.push({
        id: candidate.chunkId,
        chunkId: candidate.chunkId,
        content: chunk.content,
        sourceType: chunk.source_type,
        sourceId: chunk.source_id,
        similarityScore: candidate.similarity,
        displayScore,
        surfacedAt: Date.now(),
      });
    }
  }

  return scored
    .sort((a, b) => b.displayScore - a.displayScore)
    .slice(0, MAX_SUGGESTIONS);
}

export { MIN_DISPLAY_SCORE };
