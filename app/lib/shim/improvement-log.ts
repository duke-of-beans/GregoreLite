/**
 * SHIM Improvement Log
 *
 * Bridge between Agent SDK job lifecycle and the PatternLearner.
 * Called from job-tracker.ts after COMPLETED + EoS scan.
 * Called from executor.ts at spawn time (shim_score_before storage + predictions).
 */

import { nanoid } from 'nanoid';
import { getDatabase } from '../kernl/database';
import { getPatternLearner } from './pattern-learner';
import { extractContextFromScore } from './job-context';
import type { JobContext } from './job-context';
import type { ManifestRow } from '../agent-sdk/job-tracker';
import type { EoSScanResult } from '../eos/types';

// ─── Spawn-time: store health score before the job runs ──────────────────────

/**
 * Look up the current EoS health score for the project at `projectPath` and
 * persist it as `shim_score_before` on the manifest row.
 * Called right after insertManifest() in executor.ts.
 */
export function storeShimScoreBefore(manifestId: string, projectPath: string): void {
  try {
    const db = getDatabase();

    const row = db
      .prepare('SELECT health_score FROM projects WHERE path = ?')
      .get(projectPath) as { health_score: number | null } | null;

    const score = row?.health_score ?? null;
    if (score === null) return;

    db.prepare(
      'UPDATE manifests SET shim_score_before = ? WHERE id = ?',
    ).run(score, manifestId);
  } catch (err) {
    console.warn('[shim] storeShimScoreBefore failed:', err instanceof Error ? err.message : err);
  }
}

// ─── Spawn-time: predictions ──────────────────────────────────────────────────

/**
 * Run PatternLearner predictions before job spawn and log the top result.
 * Fire-and-forget — failure must not block job execution.
 *
 * @param projectPath  Absolute project path
 * @param fileCount    Number of files in the manifest context
 */
export function logPredictions(projectPath: string, fileCount: number): void {
  try {
    const db = getDatabase();
    const row = db
      .prepare('SELECT health_score FROM projects WHERE path = ?')
      .get(projectPath) as { health_score: number | null } | null;

    const healthScore = row?.health_score ?? 50;
    const context = extractContextFromScore(healthScore, fileCount);

    const predictions = getPatternLearner().predictSuccess(context);
    const top = predictions[0];
    if (top !== undefined && top.confidence > 0.7) {
      console.info('[shim] pattern prediction', {
        pattern: top.pattern,
        confidence: top.confidence.toFixed(3),
        expectedImpact: top.expectedImpact.toFixed(2),
      });
    }
  } catch (err) {
    console.warn('[shim] logPredictions failed:', err instanceof Error ? err.message : err);
  }
}

// ─── Completion-time: record improvement ─────────────────────────────────────

/**
 * Record a completed job's outcome with the PatternLearner.
 * Called from job-tracker.ts after the post-COMPLETED EoS scan resolves.
 *
 * @param manifestRow  The full manifest row (for shim_score_before + task type)
 * @param eosResult    Fresh EoS scan result for the project
 */
export function recordJobImprovement(
  manifestRow: ManifestRow,
  eosResult: EoSScanResult,
): void {
  try {
    const beforeScore = manifestRow.shim_score_before ?? 50;
    const afterScore = eosResult.healthScore;
    const taskType = manifestRow.task_type ?? 'code';

    // Compute context directly from EoS result (no full TaskManifest available here)
    const warnings = eosResult.issues.filter((i) => i.severity === 'warning').length;
    const estimatedLines = Math.max(1, eosResult.filesScanned * 200);
    const context: JobContext = {
      complexity: Math.max(0, Math.min(100, 100 - afterScore)),
      maintainability: Math.max(0, Math.min(100, 100 - (warnings / estimatedLines) * 100 * 10)),
      linesOfCode: 0, // ManifestRow doesn't carry the file list
    };

    getPatternLearner().recordImprovement({
      id: nanoid(),
      pattern: taskType,
      context,
      modification: {
        type: taskType,
        impactScore: afterScore - beforeScore,
      },
      outcome: {
        success: afterScore >= beforeScore,
        complexityDelta: -(afterScore - beforeScore),
        maintainabilityDelta: afterScore - beforeScore,
      },
      timestamp: Date.now(),
    });
  } catch (err) {
    console.warn('[shim] recordJobImprovement failed:', err instanceof Error ? err.message : err);
  }
}
