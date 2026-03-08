/**
 * Watchfolder Config — Sprint 34.0 / EPIC-81
 *
 * Default watchfolder path, processed subdir, supported extensions,
 * and KERNL-backed path settings.
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { getSetting, setSetting } from '@/lib/kernl/settings-store';

// ── Constants ─────────────────────────────────────────────────────────────────

export const DEFAULT_WATCHFOLDER = path.join(os.homedir(), 'GregLite', 'imports');
export const SUPPORTED_EXTENSIONS = ['.json', '.zip'];

// ── Path helpers ──────────────────────────────────────────────────────────────

/**
 * Read the configured watchfolder path from KERNL settings.
 * Falls back to DEFAULT_WATCHFOLDER if not set.
 */
export function getWatchfolderPath(): string {
  return getSetting('watchfolder_path') ?? DEFAULT_WATCHFOLDER;
}

/**
 * Persist a new watchfolder path to KERNL settings.
 */
export function setWatchfolderPath(folderPath: string): void {
  setSetting('watchfolder_path', folderPath);
}

/**
 * Returns the processed/ subdir path inside the given watchfolder.
 */
export function getProcessedDir(watchfolderPath: string): string {
  return path.join(watchfolderPath, 'processed');
}

/**
 * Ensure the watchfolder and its processed/ subdir exist.
 * Creates both directories recursively — no-op if they already exist.
 */
export function ensureWatchfolderExists(folderPath: string): void {
  fs.mkdirSync(folderPath, { recursive: true });
  fs.mkdirSync(getProcessedDir(folderPath), { recursive: true });
}
