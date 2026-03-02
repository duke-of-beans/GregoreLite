/**
 * KERNL Settings Store — Sprint 6A
 *
 * Generic key/value persistence backed by the `settings` table (Sprint 3E).
 * Used by Ghost Thread for ghost_watch_paths and other configuration.
 */

import { getDatabase } from './database';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SettingsRow {
  key: string;
  value: string;
  updated_at: number;
}

// ── Getters / Setters ─────────────────────────────────────────────────────────

/**
 * Get a settings value by key. Returns null if not found.
 */
export function getSetting(key: string): string | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(key) as Pick<SettingsRow, 'value'> | undefined;
  return row?.value ?? null;
}

/**
 * Get a settings value parsed as JSON. Returns null if not found or parse fails.
 */
export function getSettingJson<T>(key: string): T | null {
  const raw = getSetting(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Set a settings value. Upserts (INSERT OR REPLACE).
 */
export function setSetting(key: string, value: string): void {
  const db = getDatabase();
  db.prepare(
    `INSERT OR REPLACE INTO settings (key, value, updated_at)
     VALUES (?, ?, ?)`,
  ).run(key, value, Date.now());
}

/**
 * Set a settings value as JSON-serialized data.
 */
export function setSettingJson<T>(key: string, value: T): void {
  setSetting(key, JSON.stringify(value));
}

/**
 * Delete a settings entry. No-op if key does not exist.
 */
export function deleteSetting(key: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM settings WHERE key = ?').run(key);
}
