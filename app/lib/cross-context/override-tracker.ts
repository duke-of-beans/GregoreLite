/**
 * Override tracker — per-chunk override counting + threshold auto-bump (Sprint 3F)
 *
 * When David clicks "Continue Anyway" in AlreadyBuiltModal, recordOverride()
 * increments the override counter for that chunkId in the settings table.
 * After 3 overrides on the same chunk, the alreadyBuiltGate threshold is
 * bumped +0.05 and the counter is reset (pattern is no longer a surprise).
 *
 * Storage: settings table keys like `gate_override_<chunkId>`
 *
 * @module lib/cross-context/override-tracker
 */

import { getDatabase } from '@/lib/kernl/database';
import { adjustThreshold } from './thresholds';

// ── Constants ─────────────────────────────────────────────────────────────────

const OVERRIDE_KEY_PREFIX = 'gate_override_';
const OVERRIDE_THRESHOLD = 3;
const OVERRIDE_BUMP = 0.05;

// ── Helpers ───────────────────────────────────────────────────────────────────

function overrideKey(chunkId: string): string {
  return `${OVERRIDE_KEY_PREFIX}${chunkId}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get current override count for a chunk (0 if never overridden).
 */
export function getOverrideCount(chunkId: string): number {
  const db = getDatabase();
  const row = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(overrideKey(chunkId)) as { value: string } | undefined;
  return row ? parseInt(row.value, 10) : 0;
}

/**
 * Record one override for a chunk.
 * If count reaches OVERRIDE_THRESHOLD (3), bumps alreadyBuiltGate by +0.05
 * and resets the counter so the cycle can repeat.
 */
export function recordOverride(chunkId: string): void {
  const db = getDatabase();
  const key = overrideKey(chunkId);
  const current = getOverrideCount(chunkId);
  const next = current + 1;

  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, String(next), Date.now());

  if (next >= OVERRIDE_THRESHOLD) {
    adjustThreshold('alreadyBuiltGate', OVERRIDE_BUMP);
    // Reset counter — the threshold has already adapted
    db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  }
}
