/**
 * test-runner.ts — Sprint 11.1
 *
 * Runs `pnpm test:run` in the manifest's project_path directory using
 * execFileSync (never execSync — security). Parses vitest output for
 * pass/fail counts and failure details. Returns a structured TestResult.
 */

import { execFileSync } from 'child_process';

export interface TestResult {
  passed: number;
  failed: number;
  total: number;
  duration_ms: number;
  failures: Array<{ test: string; error: string }>;
}

/**
 * Run the vitest test suite in the given project directory.
 *
 * @param projectPath  Absolute path to the project root (where package.json lives).
 * @param filter       Optional test name / file filter pattern.
 * @returns            Structured TestResult. On timeout/exec failure, returns an error
 *                     result with failed=1 and a descriptive error in failures[].
 */
export function runTestRunner(projectPath: string, filter?: string): TestResult {
  const start = Date.now();
  let rawOutput = '';

  try {
    const args = ['test:run', '--reporter=verbose'];
    if (filter) {
      args.push('--testNamePattern', filter);
    }

    // pnpm resolves to the project-local binary; execFileSync avoids shell injection
    const pnpmBin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

    rawOutput = execFileSync(pnpmBin, args, {
      cwd: projectPath,
      timeout: 120_000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).toString();
  } catch (err) {
    // execFileSync throws on non-zero exit (test failures) OR timeout/missing binary.
    // Capture combined output so we can still parse pass/fail counts.
    const execErr = err as {
      stdout?: string;
      stderr?: string;
      message?: string;
      signal?: string;
    };

    if (execErr.signal === 'SIGTERM') {
      return {
        passed: 0,
        failed: 0,
        total: 0,
        duration_ms: Date.now() - start,
        failures: [{ test: '<timeout>', error: 'Test run exceeded 120 second timeout.' }],
      };
    }

    rawOutput = [execErr.stdout ?? '', execErr.stderr ?? ''].join('\n');

    if (!rawOutput.trim()) {
      return {
        passed: 0,
        failed: 1,
        total: 1,
        duration_ms: Date.now() - start,
        failures: [{ test: '<exec_error>', error: execErr.message ?? String(err) }],
      };
    }
  }

  return parseVitestOutput(rawOutput, Date.now() - start);
}

// ─── Vitest output parser ────────────────────────────────────────────────────

/**
 * Parse vitest --reporter=verbose output into a structured TestResult.
 *
 * Summary line examples:
 *   "Tests  24 passed (24)"
 *   "Tests  2 failed | 22 passed (24)"
 */
function parseVitestOutput(output: string, durationMs: number): TestResult {
  const lines = output.split('\n');

  let passed = 0;
  let failed = 0;
  let total = 0;

  // Match the summary line
  const summaryRe = /^\s*Tests\s+(?:(\d+)\s+failed\s*\|?\s*)?(\d+)\s+passed\s+\((\d+)\)/i;
  for (const line of lines) {
    const m = summaryRe.exec(line);
    if (m) {
      failed = parseInt(m[1] ?? '0', 10);
      passed = parseInt(m[2] ?? '0', 10);
      total  = parseInt(m[3] ?? '0', 10);
      break;
    }
  }

  // Collect failure blocks: FAIL / × / ✗ header + nearest error line
  const failures: Array<{ test: string; error: string }> = [];
  const failRe  = /^\s*(?:×|✗|FAIL|❌)\s+(.+)$/i;
  const errorRe = /^\s*(AssertionError|Error|TypeError|ReferenceError|expect\().+$/i;

  for (let i = 0; i < lines.length; i++) {
    const failMatch = failRe.exec(lines[i] ?? '');
    if (failMatch) {
      const testName = (failMatch[1] ?? '').trim();
      let errorMsg = '';
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const errMatch = errorRe.exec(lines[j] ?? '');
        if (errMatch) {
          errorMsg = (lines[j] ?? '').trim();
          break;
        }
      }
      failures.push({ test: testName, error: errorMsg || 'No error message captured.' });
    }
  }

  return { passed, failed, total, duration_ms: durationMs, failures };
}
