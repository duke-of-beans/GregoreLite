/**
 * Threshold calibration job (Sprint 3E)
 *
 * Runs every 100 feedback events OR every 24 hours.
 * Adjusts thresholds based on acceptance rates per surface context.
 * Detects 3+ consecutive dismissals on a chunk and raises alreadyBuiltGate.
 *
 * @module lib/cross-context/calibrator
 */

import { getDatabase } from '@/lib/kernl/database';
import {
  loadThresholds,
  saveThresholds,
  clamp,
  DRIFT_PER_EVENT,
  CONSECUTIVE_DISMISSAL_DRIFT,
} from './thresholds';
import type { CalibrationResult } from './types';

const MIN_SAMPLE_SIZE = 10;
const CALIBRATION_SETTINGS_KEY = 'last_calibration_at';

interface FeedbackRow {
  user_action: string;
}

interface ChunkDismissalRow {
  chunk_id: string;
}

/** Return the timestamp of the last completed calibration run (0 if never). */
export function getLastCalibrationTime(): number {
  const db = getDatabase();
  const row = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(CALIBRATION_SETTINGS_KEY) as { value: string } | undefined;
  return row ? parseInt(row.value, 10) : 0;
}

/** Record a calibration run timestamp in settings. */
export function recordCalibrationRun(): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(CALIBRATION_SETTINGS_KEY, String(Date.now()), Date.now());
}

/**
 * Run the calibration job synchronously.
 * Adjusts thresholds based on recent acceptance rates.
 * Detects consecutive dismissal patterns.
 */
export function runCalibration(): CalibrationResult {
  const db = getDatabase();
  const lastCalib = getLastCalibrationTime();
  const thresholdsBefore = loadThresholds();
  const thresholds = { ...thresholdsBefore };

  // ── on_input calibration ────────────────────────────────────────────────────
  const onInputFeedback = db.prepare(`
    SELECT user_action FROM suggestions
    WHERE surface_context = 'on_input'
      AND user_action IS NOT NULL
      AND acted_at > ?
    ORDER BY acted_at DESC LIMIT 100
  `).all(lastCalib) as FeedbackRow[];

  if (onInputFeedback.length >= MIN_SAMPLE_SIZE) {
    const acceptRate =
      onInputFeedback.filter((f) => f.user_action === 'accepted').length /
      onInputFeedback.length;
    if (acceptRate < 0.3) {
      thresholds.onInputSuggestion = clamp(thresholds.onInputSuggestion + DRIFT_PER_EVENT);
    } else if (acceptRate > 0.7) {
      thresholds.onInputSuggestion = clamp(thresholds.onInputSuggestion - DRIFT_PER_EVENT);
    }
  }

  // ── pattern calibration ─────────────────────────────────────────────────────
  const patternFeedback = db.prepare(`
    SELECT user_action FROM suggestions
    WHERE surface_context = 'pattern'
      AND user_action IS NOT NULL
      AND acted_at > ?
    ORDER BY acted_at DESC LIMIT 100
  `).all(lastCalib) as FeedbackRow[];

  if (patternFeedback.length >= MIN_SAMPLE_SIZE) {
    const acceptRate =
      patternFeedback.filter((f) => f.user_action === 'accepted').length /
      patternFeedback.length;
    if (acceptRate < 0.3) {
      thresholds.patternDetection = clamp(thresholds.patternDetection + DRIFT_PER_EVENT);
    } else if (acceptRate > 0.7) {
      thresholds.patternDetection = clamp(thresholds.patternDetection - DRIFT_PER_EVENT);
    }
  }

  // ── consecutive dismissal detection — +0.03 on alreadyBuiltGate ────────────
  // Chunks with 3+ dismissals and no accepts since last calibration
  const chunksWithConsecutiveDismissals = db.prepare(`
    SELECT chunk_id FROM suggestions
    WHERE user_action = 'dismissed'
      AND acted_at > ?
      AND chunk_id NOT IN (
        SELECT chunk_id FROM suggestions
        WHERE user_action = 'accepted'
          AND acted_at > ?
      )
    GROUP BY chunk_id
    HAVING COUNT(*) >= 3
  `).all(lastCalib, lastCalib) as ChunkDismissalRow[];

  if (chunksWithConsecutiveDismissals.length > 0) {
    thresholds.alreadyBuiltGate = clamp(
      thresholds.alreadyBuiltGate + CONSECUTIVE_DISMISSAL_DRIFT
    );
  }

  saveThresholds(thresholds);
  recordCalibrationRun();

  return {
    ranAt: Date.now(),
    eventsProcessed: onInputFeedback.length + patternFeedback.length,
    thresholdsBefore,
    thresholdsAfter: thresholds,
  };
}
