/**
 * EoS Health Score
 *
 * Formula from PHASE5A_EXECUTION_BRIEF.md:
 *   score = 100 - (critical × 8) - (warning × 2) - (dependencyCycles × 10)
 *   clamped to [0, 100]
 *
 * Grades:
 *   90–100  Excellent
 *   70–89   Good
 *   50–69   Needs attention
 *   0–49    Critical
 */

import type { HealthIssue } from './types.js';

export type HealthGrade = 'excellent' | 'good' | 'attention' | 'critical';

export interface HealthScoreResult {
  score: number;
  grade: HealthGrade;
  critical: number;
  warning: number;
  dependencyCycles: number;
}

/**
 * Compute the project health score.
 *
 * @param issues            Normalised issues from the scan
 * @param dependencyCycles  Circular dependency count (0 if not computed)
 */
export function computeHealthScore(
  issues: HealthIssue[],
  dependencyCycles = 0,
): HealthScoreResult {
  let critical = 0;
  let warning = 0;

  for (const issue of issues) {
    if (issue.severity === 'critical') critical++;
    else if (issue.severity === 'warning') warning++;
  }

  const raw = 100 - critical * 8 - warning * 2 - dependencyCycles * 10;
  const score = Math.max(0, Math.min(100, raw));

  const grade: HealthGrade =
    score >= 90 ? 'excellent' :
    score >= 70 ? 'good' :
    score >= 50 ? 'attention' :
    'critical';

  return { score, grade, critical, warning, dependencyCycles };
}
