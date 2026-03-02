/**
 * EoS Technical Debt Calculator — adapted TypeScript port of TechnicalDebtCalculator.js
 *
 * Computes a debt score from a set of health issues. Severity weights:
 *   critical  → 8 points
 *   warning   → 2 points
 *   info      → 0 points  (informational only, no penalty)
 *
 * Operates directly on the normalised HealthIssue array rather than the raw
 * EoS report Map, keeping debt calculation decoupled from scanner internals.
 */

import type { HealthIssue } from './types.js';

export interface DebtReport {
  /** Raw debt score (unbounded, can exceed 100) */
  totalDebt: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  /** Worst offending files sorted by local debt, highest first */
  hotspots: Array<{ file: string; debt: number; critical: number; warning: number }>;
}

const WEIGHTS: Record<HealthIssue['severity'], number> = {
  critical: 8,
  warning: 2,
  info: 0,
};

/**
 * Compute a debt report from a flat array of normalised issues.
 *
 * @param issues  All issues from an EoS scan result
 * @param topN    How many hotspot files to include (default 10)
 */
export function computeDebt(issues: HealthIssue[], topN = 10): DebtReport {
  let totalDebt = 0;
  let criticalCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  const fileMap = new Map<string, { debt: number; critical: number; warning: number }>();

  for (const issue of issues) {
    const weight = WEIGHTS[issue.severity];
    totalDebt += weight;

    switch (issue.severity) {
      case 'critical': criticalCount++; break;
      case 'warning':  warningCount++;  break;
      case 'info':     infoCount++;     break;
    }

    const existing = fileMap.get(issue.file) ?? { debt: 0, critical: 0, warning: 0 };
    existing.debt += weight;
    if (issue.severity === 'critical') existing.critical++;
    if (issue.severity === 'warning')  existing.warning++;
    fileMap.set(issue.file, existing);
  }

  const hotspots = Array.from(fileMap.entries())
    .map(([file, stats]) => ({ file, ...stats }))
    .sort((a, b) => b.debt - a.debt)
    .slice(0, topN);

  return { totalDebt, criticalCount, warningCount, infoCount, hotspots };
}
