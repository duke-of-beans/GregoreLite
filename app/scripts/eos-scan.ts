/**
 * CLI EoS scan runner — Sprint 8B
 * Usage: npx tsx scripts/eos-scan.ts
 */
import { scan } from '../lib/eos/engine';

async function main() {
  const projectPath = process.argv[2] || '.';
  const mode = (process.argv[3] || 'deep') as 'quick' | 'deep';

  console.log(`[EoS] Scanning ${projectPath} in ${mode} mode...`);
  const result = await scan(projectPath, mode);

  console.log(`\n═══ EoS Scan Results ═══`);
  console.log(`Health Score: ${result.healthScore}`);
  console.log(`Files Scanned: ${result.filesScanned}`);
  console.log(`Duration: ${result.durationMs}ms`);
  console.log(`Issues: ${result.issues.length}`);

  if (result.issues.length > 0) {
    console.log(`\n── Issues ──`);
    for (const issue of result.issues) {
      const loc = issue.line ? `:${issue.line}` : '';
      console.log(`  [${issue.severity.toUpperCase()}] ${issue.ruleId} — ${issue.file}${loc}`);
      console.log(`    ${issue.message}`);
    }
  }

  if (result.suppressed && result.suppressed.length > 0) {
    console.log(`\nSuppressed rules: ${result.suppressed.join(', ')}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
