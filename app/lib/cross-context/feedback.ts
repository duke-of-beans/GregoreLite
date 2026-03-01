/**
 * Suggestion feedback recording (Sprint 3E)
 *
 * Writes accept/dismiss/ignore events to the suggestions table.
 * Triggers calibration after 100 events or 24 hours.
 *
 * @module lib/cross-context/feedback
 */

import { getDatabase } from '@/lib/kernl/database';
import { nanoid } from 'nanoid';
import { runCalibration, getLastCalibrationTime } from './calibrator';
import type { FeedbackAction, SurfaceContext } from './types';

const CALIBRATION_EVENT_THRESHOLD = 100;
const CALIBRATION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Record a user's feedback action on a suggestion.
 * Triggers calibration if event count or time threshold is met.
 */
export function recordFeedback(suggestionId: string, action: FeedbackAction): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE suggestions SET user_action = ?, acted_at = ? WHERE id = ?
  `).run(action, Date.now(), suggestionId);

  // Trigger calibration if threshold exceeded
  const eventCount = getEventsSinceLastCalibration();
  const timeElapsed = Date.now() - getLastCalibrationTime();

  if (
    eventCount >= CALIBRATION_EVENT_THRESHOLD ||
    timeElapsed >= CALIBRATION_INTERVAL_MS
  ) {
    runCalibration();
  }
}

/**
 * Insert a new suggestion record when a candidate is surfaced to David.
 * Returns the generated suggestion ID (used for subsequent recordFeedback calls).
 */
export function insertSuggestion(
  chunkId: string,
  similarityScore: number,
  displayScore: number,
  surfaceContext: SurfaceContext
): string {
  const db = getDatabase();
  const id = nanoid();
  db.prepare(`
    INSERT INTO suggestions (id, chunk_id, similarity_score, display_score, surface_context, surfaced_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, chunkId, similarityScore, displayScore, surfaceContext, Date.now());
  return id;
}

/** Count feedback events recorded since the last calibration run. */
function getEventsSinceLastCalibration(): number {
  const db = getDatabase();
  const lastCalibAt = getLastCalibrationTime();
  const row = db.prepare(`
    SELECT COUNT(*) as count FROM suggestions
    WHERE acted_at > ? AND user_action IS NOT NULL
  `).get(lastCalibAt) as { count: number };
  return row.count;
}
