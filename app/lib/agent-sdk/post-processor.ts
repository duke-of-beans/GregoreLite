/**
 * post-processor.ts — Post-Processing SHIM Gate — Phase 7G
 *
 * Called from query.ts immediately before a session is written as COMPLETED.
 * Runs the local SHIM analyser on every file in job_state.files_modified.
 *
 * Gate logic:
 *   - Any file with shim_required: true (score < 70) → session downgraded to FAILED
 *   - Average score across all files → written to manifests.shim_score_after
 *   - Every per-file result → logged to shim_session_log (call_number = 0)
 *
 * Sessions with zero modified files pass automatically (score recorded as null).
 * Only 'code' and 'self_evolution' session types run post-processing (enforced
 * by the caller in query.ts).
 *
 * BLUEPRINT §7.6
 */

import { randomUUID } from 'crypto';
import { getDatabase } from '../kernl/database';
import { runShimCheck } from './shim-tool';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface PostProcessingResult {
  passed: boolean;
  shim_score_after: number;    // average score across all checked files (0-100)
  failedFiles: string[];       // files with shim_required: true
  failureReason: string | null;
}

// ─── Main gate ────────────────────────────────────────────────────────────────

/**
 * runPostProcessingShim — analyse all modified files and determine if the
 * session should be promoted to COMPLETED or downgraded to FAILED.
 *
 * @param manifestId    Session manifest ID.
 * @param filesModified Absolute paths of all files written during the session.
 * @param projectPath   Project root (CWD for tsc/eslint invocations).
 */
export function runPostProcessingShim(
  manifestId: string,
  filesModified: string[],
  projectPath: string,
): PostProcessingResult {
  if (filesModified.length === 0) {
    // No files modified — pass automatically, no score recorded
    writeShimScoreAfter(manifestId, null);
    return {
      passed: true,
      shim_score_after: 100,
      failedFiles: [],
      failureReason: null,
    };
  }

  const failedFiles: string[] = [];
  let totalScore = 0;

  for (const filePath of filesModified) {
    const result = runShimCheck(filePath, projectPath);
    totalScore += result.health_score;

    // Log to shim_session_log — call_number 0 marks post-processing runs
    logToShimSessionLog(manifestId, filePath, result.health_score, result.shim_required);

    if (result.shim_required) {
      failedFiles.push(filePath);
    }
  }

  const shimScoreAfter = totalScore / filesModified.length;
  writeShimScoreAfter(manifestId, shimScoreAfter);

  if (failedFiles.length > 0) {
    const failureReason =
      `Post-processing SHIM gate failed. Files with critical issues: ` +
      failedFiles.join(', ');
    return {
      passed: false,
      shim_score_after: shimScoreAfter,
      failedFiles,
      failureReason,
    };
  }

  return {
    passed: true,
    shim_score_after: shimScoreAfter,
    failedFiles: [],
    failureReason: null,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function writeShimScoreAfter(manifestId: string, score: number | null): void {
  try {
    const db = getDatabase();
    db.prepare('UPDATE manifests SET shim_score_after = ? WHERE id = ?').run(
      score,
      manifestId,
    );
  } catch {
    // DB write failure must not crash post-processing
  }
}

function logToShimSessionLog(
  manifestId: string,
  filePath: string,
  scoreAfter: number,
  shimRequired: boolean,
): void {
  try {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO shim_session_log
        (id, manifest_id, file_path, call_number, score_before, score_after, shim_required, logged_at)
      VALUES (?, ?, ?, 0, NULL, ?, ?, ?)
    `).run(
      randomUUID(),
      manifestId,
      filePath,
      scoreAfter,
      shimRequired ? 1 : 0,
      Date.now(),
    );
  } catch {
    // Log failure must not block post-processing gate
  }
}
