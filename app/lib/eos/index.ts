/**
 * EoS Public API
 *
 * The only import surface other modules should use:
 *   import { scan, scanFiles, getHealthScore } from '@/lib/eos'
 */

import { nanoid } from 'nanoid';
import { getDatabase } from '../kernl/database';
import { scan as _scan, scanFiles as _scanFiles } from './engine';
import type { EoSScanResult, ScanMode } from './types';

export type { ScanMode, EoSScanResult, HealthIssue } from './types';
export { computeHealthScore } from './health-score';
export { computeDebt } from './debt';
export {
  recordOccurrence,
  markFalsePositive,
  getSuppressedRules,
  getRuleStats,
} from './fp-tracker';

// ---------------------------------------------------------------------------
// Primary scan API
// ---------------------------------------------------------------------------

/**
 * Scan all eligible source files under `projectPath`.
 *
 * @param projectPath  Absolute path to the project root
 * @param mode         'quick' (shallow, no tests) | 'deep' (full)
 * @param projectId    KERNL project ID — used for FP suppression lookups
 */
export async function scan(
  projectPath: string,
  mode: import('./types').ScanMode = 'quick',
  projectId?: string,
): Promise<import('./types').EoSScanResult> {
  return _scan(projectPath, mode, projectId);
}

/**
 * Scan a specific list of file paths.
 * Used by the Agent SDK job-tracker hook.
 */
export async function scanFiles(
  filePaths: string[],
  projectId?: string,
): Promise<import('./types').EoSScanResult> {
  return _scanFiles(filePaths, projectId);
}

// ---------------------------------------------------------------------------
// Health score persistence
// ---------------------------------------------------------------------------

export interface StoredHealthScore {
  score: number;
  lastScannedAt: string;
}

/**
 * Read the last persisted health score for a project from KERNL.
 * Returns null if the project has never been scanned.
 */
export function getHealthScore(projectId: string): StoredHealthScore | null {
  const db = getDatabase();
  const row = db
    .prepare(`SELECT health_score, last_eos_scan FROM projects WHERE id = ?`)
    .get(projectId) as { health_score: number | null; last_eos_scan: string | null } | null;

  if (!row || row.health_score === null || row.last_eos_scan === null) return null;
  return { score: row.health_score, lastScannedAt: row.last_eos_scan };
}

/**
 * Persist a health score back to KERNL after a scan completes.
 * @deprecated Use persistScanReport() which also writes to eos_reports.
 */
export function persistHealthScore(projectId: string, score: number): void {
  const db = getDatabase();
  db.prepare(
    `UPDATE projects SET health_score = ?, last_eos_scan = datetime('now') WHERE id = ?`,
  ).run(score, projectId);
}

/**
 * Persist a full scan result to KERNL:
 *   1. Updates projects.health_score + projects.last_eos_scan
 *   2. Inserts a new row into eos_reports for UI display
 *
 * Called by job-tracker after every post-COMPLETED scan.
 */
export function persistScanReport(
  projectId: string,
  result: EoSScanResult,
  mode: ScanMode = 'quick',
): void {
  const db = getDatabase();

  // Update cached score on the project row
  db.prepare(
    `UPDATE projects SET health_score = ?, last_eos_scan = datetime('now') WHERE id = ?`,
  ).run(result.healthScore, projectId);

  // Insert scan report for UI to display
  db.prepare(`
    INSERT INTO eos_reports
      (id, project_id, health_score, issues_json, files_scanned, duration_ms, suppressed, scan_mode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    nanoid(),
    projectId,
    result.healthScore,
    JSON.stringify(result.issues),
    result.filesScanned,
    result.durationMs,
    JSON.stringify(result.suppressed),
    mode,
  );
}
