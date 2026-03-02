# GREGLITE — SPRINT 5C EXECUTION BRIEF
## Quality Layer — Integration + Phase 5 Hardening
**Instance:** Sequential after 5B (final Phase 5 sprint)
**Created:** March 1, 2026
**Project:** D:\Projects\GregLite\
**Depends on:** Sprint 5B complete

---

## YOUR ROLE

Bounded execution worker. You are certifying Phase 5 complete — end-to-end integration testing, scan performance measurement, PatternLearner data seeding, and closing out the Quality Layer as a production feature. David is CEO. Execute as COO-level engineer. Zero debt, complete implementation.

---

## MANDATORY BOOTSTRAP

Load in order:

1. `D:\Dev\CLAUDE_INSTRUCTIONS.md`
2. `D:\Dev\TECHNICAL_STANDARDS.md`
3. `D:\Projects\GregLite\DEV_PROTOCOLS.md`
4. `D:\Projects\GregLite\STATUS.md`
5. `D:\Projects\GregLite\BLUEPRINT_FINAL.md` — §11 fully
6. `D:\Projects\GregLite\SPRINT_5A_COMPLETE.md`
7. `D:\Projects\GregLite\SPRINT_5B_COMPLETE.md`

Baseline check:
```powershell
cd D:\Projects\GregLite\app
npx tsc --noEmit
pnpm test:run
```

---

## QUALITY GATES (PHASE 5 CERTIFICATION)

1. `npx tsc --noEmit` — zero errors
2. `pnpm test:run` — zero failures
3. Full EoS scan of GregLite's own codebase completes and produces a real health score
4. Health score visible in context panel with correct color (green/amber/red)
5. Agent SDK job completion triggers EoS scan on touched files (verified)
6. PatternLearner has seeded improvement records and `predictSuccess` returns results
7. FP dismiss button fires and `getSuppressedRules()` updates correctly
8. STATUS.md + BLUEPRINT_FINAL.md updated with Phase 5 complete

---

## TASKS

### Task 1 — Run EoS on GregLite itself

This is the first real scan. Run it and document what you find:

```typescript
// app/scripts/self-scan.ts
import { scan } from '../lib/eos';

const result = await scan('D:\\Projects\\GregLite\\app', 'deep');
console.log(`Health score: ${result.healthScore}/100`);
console.log(`Files scanned: ${result.filesScanned}`);
console.log(`Critical issues: ${result.issues.filter(i => i.severity === 'critical').length}`);
console.log(`Warnings: ${result.issues.filter(i => i.severity === 'warning').length}`);
console.log(`Duration: ${result.durationMs}ms`);
console.log('Top issues:');
result.issues.slice(0, 10).forEach(i => console.log(` ${i.severity}: ${i.message} (${i.file}:${i.line})`));
```

Run this script and paste the output into SPRINT_5C_COMPLETE.md. If the health score is below 70, do NOT suppress the issues to inflate the score — fix the real ones if they are legitimate, mark false positives via the FP system.

### Task 2 — Integration test suite

Write `phase5-integration.test.ts`:

```typescript
describe('Quality Layer — end-to-end', () => {
  // EoS scan
  it('scan() returns EoSScanResult with healthScore 0-100')
  it('scan() completes on GregLite app directory without error')
  it('scanFiles() runs on specific file paths')
  it('health score persisted to KERNL projects table after scan')
  it('eos_reports table populated after scan')

  // Agent SDK gate
  it('job completion triggers EoS scan on touched files')
  it('job marked FAILED when eos_required and score < 70')
  it('job marked COMPLETED when eos_required and score >= 70')

  // FP tracker
  it('recordDismissal increments dismissal count for ruleId')
  it('rule with 20 dismissals in 100 events appears in getSuppressedRules()')
  it('suppressed rules excluded from scan results')
  it('POST /api/eos/fp calls recordDismissal')

  // PatternLearner
  it('recordImprovement persists to shim_improvements table')
  it('PatternLearner hydrates from KERNL on init')
  it('predictSuccess returns PredictionScore array')
  it('learnPatterns returns Pattern array after 5+ improvements')

  // Score < 70 surfacing
  it('scan with score < 70 creates suggestion in context panel')
});
```

### Task 3 — Seed PatternLearner

The PatternLearner needs historical data to be useful. Seed it with realistic improvement records derived from Phase 1-4 build history:

```typescript
// app/scripts/seed-patterns.ts
// Create 20 realistic improvement records covering the task types
// that Agent SDK sessions actually run: code, test, documentation, analysis

const improvements = [
  { pattern: 'code', context: { complexity: 45, maintainability: 70, linesOfCode: 800 },
    modification: { type: 'code', impactScore: 15 }, outcome: { success: true, complexityDelta: -10, maintainabilityDelta: 15 } },
  // ... 19 more
];

for (const imp of improvements) {
  await patternLearner.recordImprovement({ id: nanoid(), ...imp, timestamp: Date.now() });
}
```

After seeding, run `patternLearner.getTopPatterns(5)` and log the results — this confirms the learning engine is working.

### Task 4 — Performance measurement

Measure and record in SPRINT_5C_COMPLETE.md:

| Metric | Target | Measured |
|--------|--------|----------|
| Full scan of GregLite app/ | < 30s | ? |
| `scanFiles()` on 10 files | < 5s | ? |
| PatternLearner `predictSuccess()` | < 10ms | ? |
| Health score computation | < 1ms | ? |
| Context panel render with EoS data | < 16ms | ? |

### Task 5 — Context panel polish

Verify the quality section in `ContextPanel.tsx` renders correctly in all states:
- No scan yet → show "No scan data" placeholder
- Scan in progress → show loading indicator (same shimmer as KERNL status)
- Score ≥ 80 → green indicator
- Score 60-79 → amber indicator
- Score < 60 → red indicator
- 0 issues → "✓ No issues detected"
- Issues present → issue rows with FP dismiss buttons

### Task 6 — War Room integration

The War Room (Sprint 2E) shows job dependency graphs. Add a health score badge to each completed job node — the EoS score for that job's touched files:

```tsx
// In JobNode.tsx — when job status is 'complete':
{job.eosScore !== undefined && (
  <span className={`eos-badge ${scoreClass(job.eosScore)}`}>
    {job.eosScore}
  </span>
)}
```

Read the EoS score from the manifest's `result_report.eos.healthScore` field (written by Sprint 5A's job gate logic).

### Task 7 — Update BLUEPRINT_FINAL.md

In §13, mark Phase 5 complete with date and key measurements.

### Task 8 — Phase 6 readiness

Phase 6 is the Ghost Thread (filesystem watcher + email ingest). Read §6 in BLUEPRINT_FINAL.md. Note any dependencies Phase 6 needs from Phase 5 infrastructure. Record in SPRINT_5C_COMPLETE.md.

---

## SESSION END

1. Zero errors, zero failures
2. Update `D:\Projects\GregLite\STATUS.md` — Phase 5 complete
3. Update `D:\Projects\GregLite\BLUEPRINT_FINAL.md` — Phase 5 completion noted in §13
4. `git commit -m "phase-5: complete — EoS integration, PatternLearner, FP tracker, health scores"`
5. `git push`
6. Write `SPRINT_5C_COMPLETE.md`:
   - GregLite self-scan output (full)
   - All benchmark measurements
   - PatternLearner top patterns after seeding
   - Any EoS rules that produced false positives on GregLite's own code
   - Phase 6 dependencies identified

---

## GATES CHECKLIST (PHASE 5 CERTIFICATION)

- [ ] GregLite self-scan produces real health score (documented in SPRINT_5C_COMPLETE.md)
- [ ] Context panel quality section renders with color-coded score
- [ ] All integration tests passing (20+ tests in phase5-integration.test.ts)
- [ ] Agent SDK job gate verified end-to-end (COMPLETED and FAILED paths)
- [ ] FP dismiss fires and suppression updates within the same session
- [ ] PatternLearner seeded with 20 records, `getTopPatterns(5)` returns results
- [ ] War Room job nodes show EoS score badge on completed jobs
- [ ] Full scan of GregLite app/ under 30s (measured)
- [ ] BLUEPRINT_FINAL.md Phase 5 marked complete
- [ ] `npx tsc --noEmit` zero errors
- [ ] `pnpm test:run` zero failures
- [ ] Phase 5 completion commit pushed
