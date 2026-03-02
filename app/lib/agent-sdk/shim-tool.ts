/**
 * shim-tool.ts — Local Quality Analyser — Phase 7G
 *
 * Implements the shim_check in-session tool as a fully local analyser.
 * No MCP call to the SHIM server (whose actual MCP interface is crash-prevention
 * only — see SPRINT_7G_COMPLETE.md §SHIM_MCP_DISCOVERY for the decision rationale).
 *
 * Analysis pipeline per file:
 *   1. TypeScript check (40 pts) — npx tsc --noEmit, filter to this file's errors
 *   2. ESLint check   (40 pts) — npx eslint --format json, severity 2 = critical
 *   3. LOC score      (20 pts) — <300 = 20, <500 = 10, <1000 = 5, ≥1000 = 0
 *
 * shim_required = true when health_score < 70
 * critical_issues = TS errors + ESLint severity-2 (error) messages
 * warning_issues  = ESLint severity-1 (warning) messages
 *
 * BLUEPRINT §7.6 (SHIM integration in self-evolution)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ShimCheckResult {
  file_path: string;
  health_score: number;        // 0-100
  shim_required: boolean;      // true when score < 70
  critical_issues: string[];   // TS errors + ESLint severity-2
  warning_issues: string[];    // ESLint severity-1
  suggestion: string;          // Actionable next step for the agent
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SHIM_REQUIRED_THRESHOLD = 70;
const TS_MAX_SCORE   = 40;
const LINT_MAX_SCORE = 40;
const SCORE_DEDUCT_PER_TS_ERROR    = 10;
const SCORE_DEDUCT_PER_LINT_ERROR  = 10;  // severity 2
const SCORE_DEDUCT_PER_LINT_WARN   = 2;   // severity 1

const TS_EXTENSIONS   = new Set(['.ts', '.tsx']);
const LINT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

// ─── Main analyser ────────────────────────────────────────────────────────────

/**
 * runShimCheck — analyse a single file and return a quality report.
 *
 * @param filePath    Absolute path to the file to check.
 * @param projectPath Absolute path to project root (CWD for tsc/eslint commands).
 */
export function runShimCheck(filePath: string, projectPath: string): ShimCheckResult {
  if (!fs.existsSync(filePath)) {
    return {
      file_path: filePath,
      health_score: 0,
      shim_required: true,
      critical_issues: [`File not found: ${filePath}`],
      warning_issues: [],
      suggestion: 'Write the file before running SHIM check.',
    };
  }

  const ext = path.extname(filePath).toLowerCase();
  const criticalIssues: string[] = [];
  const warningIssues: string[] = [];

  // ── LOC score ──────────────────────────────────────────────────────────────
  const content    = fs.readFileSync(filePath, 'utf8');
  const lineCount  = content.split('\n').length;
  const locScore   = lineCount < 300 ? 20
                   : lineCount < 500 ? 10
                   : lineCount < 1000 ? 5
                   : 0;

  // ── TypeScript check ───────────────────────────────────────────────────────
  let tsScore = TS_MAX_SCORE;

  if (TS_EXTENSIONS.has(ext)) {
    try {
      execSync('npx tsc --noEmit', {
        cwd: projectPath,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 45_000,
      });
      // Exit 0 — no errors
    } catch (err) {
      const tscErr = err as { stdout?: string; stderr?: string };
      const output = (tscErr.stdout ?? '') + (tscErr.stderr ?? '');
      const normalized = filePath.replace(/\\/g, '/');

      const fileErrors = output
        .split('\n')
        .filter((line) => {
          const n = line.replace(/\\/g, '/');
          return n.includes(normalized) && / error TS\d+:/.test(line);
        });

      fileErrors.forEach((line) => {
        const match = line.match(/error TS\d+: (.+)$/);
        if (match) criticalIssues.push(`TS: ${match[1]?.trim() ?? ''}`);
      });

      tsScore = Math.max(0, TS_MAX_SCORE - fileErrors.length * SCORE_DEDUCT_PER_TS_ERROR);
    }
  }

  // ── ESLint check ───────────────────────────────────────────────────────────
  let eslintScore = LINT_MAX_SCORE;

  if (LINT_EXTENSIONS.has(ext)) {
    // Normalize backslashes so ESLint on Windows handles the path correctly
    const escapedPath = filePath.replace(/\\/g, '/');

    let eslintOutput = '';
    try {
      eslintOutput = execSync(`npx eslint "${escapedPath}" --format json --no-error-on-unmatched-pattern`, {
        cwd: projectPath,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30_000,
      });
    } catch (err) {
      // ESLint exits with code 1 when lint errors exist — output still in stdout
      eslintOutput = (err as { stdout?: string }).stdout ?? '[]';
    }

    try {
      const results = JSON.parse(eslintOutput) as Array<{
        messages: Array<{ severity: number; message: string; ruleId: string | null }>;
      }>;
      if (results.length > 0) {
        const messages = results[0]?.messages ?? [];
        const errors   = messages.filter((m) => m.severity === 2);
        const warnings = messages.filter((m) => m.severity === 1);

        errors.forEach((m) =>
          criticalIssues.push(`ESLint: ${m.message}${m.ruleId ? ` (${m.ruleId})` : ''}`)
        );
        warnings.forEach((m) =>
          warningIssues.push(`${m.message}${m.ruleId ? ` (${m.ruleId})` : ''}`)
        );

        eslintScore = Math.max(
          0,
          LINT_MAX_SCORE
            - errors.length * SCORE_DEDUCT_PER_LINT_ERROR
            - warnings.length * SCORE_DEDUCT_PER_LINT_WARN,
        );
      }
    } catch {
      // Unparseable ESLint output — score ESLint section as 0, note it as warning
      eslintScore = 0;
      warningIssues.push('ESLint output could not be parsed');
    }
  }

  // ── Final score ────────────────────────────────────────────────────────────
  const healthScore  = Math.min(100, tsScore + eslintScore + locScore);
  const shimRequired = healthScore < SHIM_REQUIRED_THRESHOLD;

  let suggestion: string;
  if (shimRequired && criticalIssues.length > 0) {
    suggestion =
      `Fix these critical issues before proceeding: ` +
      criticalIssues.slice(0, 3).join('; ');
  } else if (shimRequired) {
    suggestion =
      `Quality score (${healthScore}) is below threshold (${SHIM_REQUIRED_THRESHOLD}). ` +
      `Review the file for structural issues (LOC: ${lineCount}).`;
  } else if (warningIssues.length > 0) {
    suggestion =
      `File passes quality gate (score: ${healthScore}). ` +
      `Consider addressing: ${warningIssues.slice(0, 2).join('; ')}`;
  } else {
    suggestion = `File passes all quality checks (score: ${healthScore}/100). Continue.`;
  }

  return {
    file_path: filePath,
    health_score: healthScore,
    shim_required: shimRequired,
    critical_issues: criticalIssues,
    warning_issues: warningIssues,
    suggestion,
  };
}
