/**
 * Threshold storage and drift logic (Sprint 3E)
 *
 * Thresholds are persisted in KERNL `settings` table under key 'threshold_config'.
 * All values are clamped to [0.65, 0.92] at all times.
 *
 * @module lib/cross-context/thresholds
 */

import { getDatabase } from '@/lib/kernl/database';
import type { ThresholdConfig } from './types';

export const THRESHOLD_MIN = 0.65;
export const THRESHOLD_MAX = 0.92;
export const DRIFT_PER_EVENT = 0.01;
export const CONSECUTIVE_DISMISSAL_DRIFT = 0.03;

const SETTINGS_KEY = 'threshold_config';

export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  patternDetection: 0.75,
  onInputSuggestion: 0.85,
  alreadyBuiltGate: 0.72,
};

/** Clamp a threshold value to the valid range [0.65, 0.92]. */
export function clamp(value: number): number {
  return Math.max(THRESHOLD_MIN, Math.min(THRESHOLD_MAX, value));
}

/** Load persisted thresholds from KERNL settings. Falls back to defaults. */
export function loadThresholds(): ThresholdConfig {
  const db = getDatabase();
  const row = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(SETTINGS_KEY) as { value: string } | undefined;

  if (!row) return { ...DEFAULT_THRESHOLDS };

  try {
    const parsed = JSON.parse(row.value) as Partial<ThresholdConfig>;
    return {
      patternDetection: parsed.patternDetection ?? DEFAULT_THRESHOLDS.patternDetection,
      onInputSuggestion: parsed.onInputSuggestion ?? DEFAULT_THRESHOLDS.onInputSuggestion,
      alreadyBuiltGate: parsed.alreadyBuiltGate ?? DEFAULT_THRESHOLDS.alreadyBuiltGate,
    };
  } catch {
    return { ...DEFAULT_THRESHOLDS };
  }
}

/** Persist thresholds to KERNL settings. All values clamped before save. */
export function saveThresholds(config: ThresholdConfig): void {
  const db = getDatabase();
  const clamped: ThresholdConfig = {
    patternDetection: clamp(config.patternDetection),
    onInputSuggestion: clamp(config.onInputSuggestion),
    alreadyBuiltGate: clamp(config.alreadyBuiltGate),
  };
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(SETTINGS_KEY, JSON.stringify(clamped), Date.now());
}

/** Apply a delta to a single threshold key and save. */
export function adjustThreshold(key: keyof ThresholdConfig, delta: number): void {
  const config = loadThresholds();
  config[key] = clamp(config[key] + delta);
  saveThresholds(config);
}
