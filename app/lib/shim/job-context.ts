/**
 * SHIM Job Context Extractor
 *
 * Maps a GregLite TaskManifest + EoS scan result to the context shape
 * expected by PatternLearner (complexity / maintainability / linesOfCode).
 *
 * Proxy mappings:
 *   complexity      = 100 - healthScore  (higher score = lower complexity)
 *   maintainability = 100 - warning density per 100 lines (capped 0–100)
 *   linesOfCode     = file count × 100 (rough estimate; no estimated_lines in manifest)
 */

import type { TaskManifest } from '../agent-sdk/types.js';
import type { EoSScanResult } from '../eos/types.js';

export interface JobContext {
  complexity: number;
  maintainability: number;
  linesOfCode: number;
}

/**
 * Extract a PatternLearner-compatible context from a manifest and its
 * post-job EoS scan result.
 *
 * @param manifest    The TaskManifest that was executed
 * @param eosResult   EoS scan completed after the job finished
 */
export function extractContext(
  manifest: TaskManifest,
  eosResult: EoSScanResult,
): JobContext {
  // Complexity: inverse of health score.  Score 100 → complexity 0; Score 0 → complexity 100.
  const complexity = Math.max(0, Math.min(100, 100 - eosResult.healthScore));

  // Maintainability: penalise warning density (warnings per 100 lines).
  // Use filesScanned × 200 as a rough line count estimate.
  const warnings = eosResult.issues.filter((i) => i.severity === 'warning').length;
  const estimatedLines = Math.max(1, eosResult.filesScanned * 200);
  const warningDensity = (warnings / estimatedLines) * 100;
  const maintainability = Math.max(0, Math.min(100, 100 - warningDensity * 10));

  // Lines of code: file count from manifest context, defaulting to 100 lines/file.
  const linesOfCode = (manifest.context.files?.length ?? 0) * 100;

  return { complexity, maintainability, linesOfCode };
}

/**
 * Build a context snapshot from a stored health score alone
 * (used before job spawn when no fresh EoS scan is available).
 *
 * @param healthScore  Stored projects.health_score value (0–100)
 * @param fileCount    Number of files in manifest context
 */
export function extractContextFromScore(
  healthScore: number,
  fileCount: number,
): JobContext {
  const complexity = Math.max(0, Math.min(100, 100 - healthScore));
  // Without a fresh scan we can't compute warning density — use complexity as proxy
  const maintainability = Math.max(0, Math.min(100, healthScore));
  const linesOfCode = fileCount * 100;
  return { complexity, maintainability, linesOfCode };
}
