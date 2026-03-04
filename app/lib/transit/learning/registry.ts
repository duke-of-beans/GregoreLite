/**
 * Transit Map Learning Engine — Insight Registry (CRUD)
 * Sprint 11.7 | TRANSIT_MAP_SPEC.md §6.3
 *
 * CRUD for learning_insights table.
 * Every applied insight stores before_state so rollback is always possible (§6.3).
 * Rollback returns before_state JSON so callers can restore the adjusted value.
 */

import { getDatabase } from '@/lib/kernl/database';
import type { LearningInsight, InsightStatus, LearningInsightRow } from './types';

// ── Helpers ────────────────────────────────────────────────────────────────────

function rowToInsight(row: LearningInsightRow): LearningInsight {
  return {
    id: row.id,
    pattern_type: row.pattern_type,
    title: row.title,
    description: row.description,
    confidence: row.confidence,
    sample_size: row.sample_size,
    status: row.status as InsightStatus,
    adjustment: JSON.parse(row.adjustment) as LearningInsight['adjustment'],
    before_state: row.before_state,
    after_state: row.after_state,
    created_at: row.created_at,
    applied_at: row.applied_at,
    expires_at: row.expires_at,
  };
}

// ── Write operations ───────────────────────────────────────────────────────────

/**
 * Store a new insight.
 * If insight.id already exists (merge/dedup case), upserts:
 *   - confidence = MAX(existing, new)
 *   - sample_size = MAX(existing, new)
 *   - description updated
 * Caller sets insight.id = existing.id to trigger the upsert path.
 */
export function storeInsight(insight: LearningInsight): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO learning_insights
      (id, pattern_type, title, description, confidence, sample_size,
       status, adjustment, before_state, after_state, created_at, applied_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      confidence   = MAX(confidence, excluded.confidence),
      sample_size  = MAX(sample_size, excluded.sample_size),
      description  = excluded.description
  `).run(
    insight.id,
    insight.pattern_type,
    insight.title,
    insight.description,
    Math.round(insight.confidence),
    insight.sample_size,
    insight.status,
    JSON.stringify(insight.adjustment),
    insight.before_state,
    insight.after_state,
    insight.created_at,
    insight.applied_at,
    insight.expires_at,
  );
}

/**
 * Apply an insight: capture after_state, set status='applied', set applied_at.
 * Callers must pass the JSON snapshot of state AFTER the adjustment was made.
 */
export function applyInsight(id: string, afterState: string): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE learning_insights
    SET status = 'applied', after_state = ?, applied_at = ?
    WHERE id = ?
  `).run(afterState, Date.now(), id);
}

/** Dismiss an insight: set status='dismissed'. */
export function dismissInsight(id: string): void {
  const db = getDatabase();
  db.prepare(`UPDATE learning_insights SET status = 'dismissed' WHERE id = ?`).run(id);
}

/**
 * Rollback an applied insight.
 * Sets status='rolled_back' and returns before_state JSON.
 * The caller uses before_state to restore the previous system configuration.
 *
 * @throws Error if insight not found
 */
export function rollbackInsight(id: string): { beforeState: string } {
  const db = getDatabase();
  const row = db.prepare(
    `SELECT before_state FROM learning_insights WHERE id = ?`,
  ).get(id) as { before_state: string } | undefined;

  if (!row) {
    throw new Error(`[learning/registry] Insight not found for rollback: ${id}`);
  }

  db.prepare(`UPDATE learning_insights SET status = 'rolled_back' WHERE id = ?`).run(id);
  return { beforeState: row.before_state };
}

/**
 * Decay: mark insights older than 90 days (expires_at < now) as 'expired'.
 * Only affects 'proposed' and 'approved' status (not applied/dismissed/rolled_back).
 *
 * @returns count of insights expired
 */
export function decayExpiredInsights(): number {
  const db = getDatabase();
  const result = db.prepare(`
    UPDATE learning_insights
    SET status = 'expired'
    WHERE expires_at < ? AND status IN ('proposed', 'approved')
  `).run(Date.now());
  return result.changes;
}

// ── Read operations ────────────────────────────────────────────────────────────

/** Get all insights ordered newest-first. Used by the UI listing. */
export function getAllInsights(): LearningInsight[] {
  const db = getDatabase();
  const rows = db.prepare(
    `SELECT * FROM learning_insights ORDER BY created_at DESC`,
  ).all() as LearningInsightRow[];
  return rows.map(rowToInsight);
}

/** Get insights filtered by a single status, ordered newest-first. */
export function getInsightsByStatus(status: InsightStatus): LearningInsight[] {
  const db = getDatabase();
  const rows = db.prepare(
    `SELECT * FROM learning_insights WHERE status = ? ORDER BY created_at DESC`,
  ).all(status) as LearningInsightRow[];
  return rows.map(rowToInsight);
}
