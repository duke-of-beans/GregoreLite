/**
 * EoS Public API
 *
 * The only import surface other modules should use:
 *   import { scan, scanFiles, getHealthScore } from '@/lib/eos'
 */

import { getDatabase } from '../kernl/database.js';
import { scan as _scan, scanFiles as _scanFiles } from './engine.js';

export type { ScanMode, EoSScanResult, HealthIssue } from './types.js';
export { computeHealthScore } from './health-score.js';
export { computeDebt } from './debt.js';
export {
  recordOccurrence,
  markFalsePositive,
  getSuppressedRules,
  getRuleStats,
} from './fp-tracker.js';

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
  mode: import('./types.js').ScanMode = 'quick',
  projectId?: string,
): Promise<import('./types.js').EoSScanResult> {
  return _scan(projectPath, mode, projectId);
}

/**
 * Scan a specific list of file paths.
 * Used by the Agent SDK job-tracker hook.
 */
export async function scanFiles(
  filePaths: string[],
  projectId?: string,
): Promise<import('./types.js').EoSScanResult> {
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
 * Called by the job-tracker hook — not intended for direct use.
 */
export function persistHealthScore(projectId: string, score: number): void {
  const db = getDatabase();
  db.prepare(
    `UPDATE projects SET health_score = ?, last_eos_scan = datetime('now') WHERE id = ?`,
  ).run(score, projectId);
}
