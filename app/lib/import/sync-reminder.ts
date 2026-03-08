/**
 * Sync Reminder — Sprint 34.0 / EPIC-81
 *
 * Computes days since last memory sync and whether a reminder is due.
 * Used by StatusBar MEM chip and /api/import/sync-status route.
 *
 * Reminder threshold reads from KERNL 'import_reminder_days' setting.
 * Defaults to 14 days if not configured.
 *
 * Returns null (not 0) when no imports have ever been made — the chip
 * stays hidden until the user has imported at least once.
 */

import { getDatabase } from '@/lib/kernl/database';
import { getSetting } from '@/lib/kernl/settings-store';

const DEFAULT_REMINDER_DAYS = 14;
const SYNC_REMINDER_URL = 'https://claude.ai/settings';

// ── Config ────────────────────────────────────────────────────────────────────

/**
 * Get the configured reminder threshold in days.
 * Reads 'import_reminder_days' from KERNL settings; falls back to 14.
 */
export function getReminderDays(): number {
  const raw = getSetting('import_reminder_days');
  if (raw === null) return DEFAULT_REMINDER_DAYS;
  const n = parseInt(raw, 10);
  return isNaN(n) || n <= 0 ? DEFAULT_REMINDER_DAYS : n;
}

// ── Data queries ──────────────────────────────────────────────────────────────

/**
 * Returns the most recent last_synced_at timestamp across all imported sources,
 * or null if no sources exist.
 */
export function getLastSyncedAt(): number | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT MAX(last_synced_at) AS ts FROM imported_sources')
    .get() as { ts: number | null } | undefined;
  return row?.ts ?? null;
}

/**
 * Returns the number of days since the most recent sync, or null if never synced.
 * null means the MEM chip should stay hidden — no nag before first import.
 */
export function getDaysSinceSync(): number | null {
  const last = getLastSyncedAt();
  if (last === null) return null;
  return Math.floor((Date.now() - last) / 86_400_000);
}

// ── Reminder logic ────────────────────────────────────────────────────────────

/**
 * Returns true if the user should be prompted to re-sync.
 * False if never synced (no nagging) or within the threshold.
 */
export function shouldShowReminder(): boolean {
  const days = getDaysSinceSync();
  if (days === null) return false;
  return days >= getReminderDays();
}

/**
 * The URL the MEM chip links to when reminder is due.
 */
export function getSyncReminderUrl(): string {
  return SYNC_REMINDER_URL;
}
