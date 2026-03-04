/**
 * shim-readonly-audit.ts — Sprint 11.1
 *
 * Runs an EoS engine scan on a target path, read-only.
 * Returns health score, grade, file count, and issues — no modifications.
 */

import fs from 'fs';
import { scan, scanFiles } from '../../eos/engine';
import type { HealthIssue } from '../../eos/types';

export interface AuditIssue {
  rule: string;
  severity: string;
  file: string;
  line?: number;
  message: string;
}

export interface AuditResult {
  healthScore: number;
  grade: string;
  fileCount: number;
  issues: AuditIssue[];
  durationMs: number;
}

/**
 * Derive a letter grade from a 0–100 health score, matching EoS scoreClass.
 */
function gradeFromScore(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 50) return 'C';
  return 'D';
}

function mapIssues(raw: HealthIssue[]): AuditIssue[] {
  return raw.map((issue) => ({
    rule:     issue.ruleId,
    severity: issue.severity,
    file:     issue.file,
    ...(issue.line !== undefined ? { line: issue.line } : {}),
    message:  issue.message,
  }));
}

/**
 * Run a read-only EoS audit on targetPath.
 *
 * Single file → scanFiles([targetPath])
 * Directory   → scan(targetPath, 'deep')
 * Missing     → returns error AuditResult with healthScore=0
 */
export async function runShimReadonlyAudit(targetPath: string): Promise<AuditResult> {
  if (!fs.existsSync(targetPath)) {
    return {
      healthScore: 0,
      grade: 'D',
      fileCount: 0,
      issues: [{
        rule: 'path_not_found',
        severity: 'critical',
        file: targetPath,
        message: `Path not found: ${targetPath}`,
      }],
      durationMs: 0,
    };
  }

  const stat = fs.statSync(targetPath);
  const start = Date.now();

  if (stat.isFile()) {
    const result = await scanFiles([targetPath]);
    return {
      healthScore: result.healthScore,
      grade:       gradeFromScore(result.healthScore),
      fileCount:   result.filesScanned,
      issues:      mapIssues(result.issues),
      durationMs:  Date.now() - start,
    };
  }

  // Directory scan
  const result = await scan(targetPath, 'deep');
  return {
    healthScore: result.healthScore,
    grade:       gradeFromScore(result.healthScore),
    fileCount:   result.filesScanned,
    issues:      mapIssues(result.issues),
    durationMs:  Date.now() - start,
  };
}
