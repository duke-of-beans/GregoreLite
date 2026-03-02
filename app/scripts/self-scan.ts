/**
 * GregLite Self-Scan
 *
 * Runs EoS on GregLite's own app/ directory and reports results.
 * Output is pasted into SPRINT_5C_COMPLETE.md as the baseline health score.
 *
 * Run:
 *   node --import tsx/esm scripts/self-scan.ts
 *   (or: npx tsx scripts/self-scan.ts)
 */

import { scan } from '../lib/eos/engine.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectPath = path.resolve(__dirname, '..');

console.log('─'.repeat(60));
console.log('EoS Self-Scan — GregLite app/');
console.log(`Path: ${projectPath}`);
console.log('─'.repeat(60));

void (async () => {
  const start = Date.now();
  const result = await scan(projectPath, 'deep');
  const elapsed = Date.now() - start;

  const criticalCount = result.issues.filter((i) => i.severity === 'critical').length;
  const warningCount = result.issues.filter((i) => i.severity === 'warning').length;
  const infoCount = result.issues.filter((i) => i.severity === 'info').length;

  console.log(`\nHealth score:    ${result.healthScore}/100`);
  console.log(`Files scanned:   ${result.filesScanned}`);
  console.log(`Duration:        ${result.durationMs}ms  (wall: ${elapsed}ms)`);
  console.log(`Suppressed:      ${result.suppressed.length} rule(s)`);
  console.log(`\nIssues:          ${result.issues.length} total`);
  console.log(`  Critical:      ${criticalCount}`);
  console.log(`  Warning:       ${warningCount}`);
  console.log(`  Info:          ${infoCount}`);

  if (result.issues.length > 0) {
    console.log('\nTop 15 issues:');
    result.issues.slice(0, 15).forEach((issue, i) => {
      const shortFile = issue.file.replace(projectPath, '');
      const loc = issue.line != null ? `:${issue.line}` : '';
      console.log(`  ${String(i + 1).padStart(2)}. [${issue.severity.toUpperCase().padEnd(8)}] ${issue.ruleId}`);
      console.log(`      ${issue.message}`);
      console.log(`      ${shortFile}${loc}`);
    });
  }

  if (result.suppressed.length > 0) {
    console.log('\nSuppressed rules:', result.suppressed.join(', '));
  }

  console.log('\n' + '─'.repeat(60));
  console.log('Scan complete.');
})();
