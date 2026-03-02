/**
 * EoS False Positive Tracker
 *
 * Persists FP feedback to KERNL (eos_fp_log table) and auto-suppresses
 * rules whose FP rate exceeds 20% over the last 100 occurrences.
 */

import { nanoid } from 'nanoid';
import { getDatabase } from '../kernl/database.js';

const FP_THRESHOLD = 0.2;
const WINDOW_SIZE = 100;

export interface FPEntry {
  id: string;
  projectId: string;
  ruleId: string;
  filePath: string;
  line?: number;
  isFP: boolean;
  createdAt: string;
}

export interface FPStats {
  ruleId: string;
  total: number;
  fpCount: number;
  rate: number;
  suppressed: boolean;
}

// ---------------------------------------------------------------------------
// Record a single occurrence (true positive or false positive)
// ---------------------------------------------------------------------------

export function recordOccurrence(params: {
  projectId: string;
  ruleId: string;
  filePath: string;
  line?: number;
  isFP: boolean;
}): void {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO eos_fp_log (id, project_id, rule_id, file_path, line, is_fp)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    nanoid(),
    params.projectId,
    params.ruleId,
    params.filePath,
    params.line ?? null,
    params.isFP ? 1 : 0,
  );
}

// ---------------------------------------------------------------------------
// Mark an existing occurrence as a false positive (UI feedback path)
// ---------------------------------------------------------------------------

export function markFalsePositive(entryId: string): void {
  const db = getDatabase();
  db.prepare(`UPDATE eos_fp_log SET is_fp = 1 WHERE id = ?`).run(entryId);
}

// ---------------------------------------------------------------------------
// Compute suppressed rule IDs for a project
// ---------------------------------------------------------------------------

export function getSuppressedRules(projectId: string): Set<string> {
  const db = getDatabase();

  const ruleRows = db
    .prepare(`SELECT DISTINCT rule_id FROM eos_fp_log WHERE project_id = ?`)
    .all(projectId) as Array<{ rule_id: string }>;

  const suppressed = new Set<string>();

  for (const { rule_id } of ruleRows) {
    const rows = db
      .prepare(
        `SELECT is_fp FROM eos_fp_log
         WHERE project_id = ? AND rule_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(projectId, rule_id, WINDOW_SIZE) as Array<{ is_fp: number }>;

    if (rows.length === 0) continue;

    const fpCount = rows.filter((r) => r.is_fp === 1).length;
    if (fpCount / rows.length > FP_THRESHOLD) {
      suppressed.add(rule_id);
    }
  }

  return suppressed;
}

// ---------------------------------------------------------------------------
// Stats for a specific rule
// ---------------------------------------------------------------------------

export function getRuleStats(projectId: string, ruleId: string): FPStats {
  const db = getDatabase();

  const rows = db
    .prepare(
      `SELECT is_fp FROM eos_fp_log
       WHERE project_id = ? AND rule_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(projectId, ruleId, WINDOW_SIZE) as Array<{ is_fp: number }>;

  const total = rows.length;
  const fpCount = rows.filter((r) => r.is_fp === 1).length;
  const rate = total > 0 ? fpCount / total : 0;

  return { ruleId, total, fpCount, rate, suppressed: rate > FP_THRESHOLD };
}
