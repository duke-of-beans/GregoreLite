# GREGLITE — SPRINT 5A EXECUTION BRIEF
## Quality Layer — Eye of Sauron Integration
**Instance:** Sequential, first Phase 5 sprint
**Created:** March 1, 2026
**Project:** D:\Projects\GregLite\
**Phase 4 baseline:** 474/474 tests passing, tsc 0 errors

---

## YOUR ROLE

Bounded execution worker. You are migrating the useful analysis core from the standalone Eye of Sauron project into GregLite as a native TypeScript module. No server, no CLI, no separate process — direct function calls only. David is CEO. Execute as COO-level engineer. Zero debt, complete implementation.

---

## CRITICAL: READ FIRST, BUILD SECOND

Before writing a single line of GregLite code, read these source files in order:

```
D:\Projects\eye-of-sauron\core\EyeOfSauronOmniscient.js   ← main scan engine
D:\Projects\eye-of-sauron\core\CharacterForensics.js        ← character/invisible char analysis
D:\Projects\eye-of-sauron\core\PatternPrecognition.js       ← code pattern analysis
D:\Projects\eye-of-sauron\performance\BatchProcessor.js     ← batch file processing
D:\Projects\eye-of-sauron\core\SauronConfigLoader.js        ← config structure
D:\Projects\eye-of-sauron\utils\SauronDependencyGraph.js    ← dependency cycle detection
D:\Projects\eye-of-sauron\utils\TechnicalDebtCalculator.js  ← debt scoring
```

Then read `D:\Projects\eye-of-sauron\.sauronrc.json` to understand the config schema.

You are extracting only what is useful. Do not migrate the server, CLI, reporters, scheduler, license manager, plugin manager, or anything in `utils/` that is not the dependency graph or debt calculator.

---

## MANDATORY BOOTSTRAP

Load in order:

1. `D:\Dev\CLAUDE_INSTRUCTIONS.md`
2. `D:\Dev\TECHNICAL_STANDARDS.md`
3. `D:\Projects\GregLite\DEV_PROTOCOLS.md`
4. `D:\Projects\GregLite\STATUS.md`
5. `D:\Projects\GregLite\BLUEPRINT_FINAL.md` — §11 (Quality Layer)
6. `D:\Projects\GregLite\SPRINT_4C_COMPLETE.md` — Phase 5 dependencies noted there

Baseline check:
```powershell
cd D:\Projects\GregLite\app
npx tsc --noEmit
pnpm test:run
```

---

## AUTHORITY PROTOCOL — STOP WHEN:

- Eye of Sauron source files use CommonJS/ESM patterns incompatible with GregLite's TypeScript strict — resolve before proceeding, do not use `any` as a workaround
- Any single analysis rule produces false positives on >20% of GregLite's own source files — flag it for suppression, do not migrate it
- Same fix 3+ times

---

## WHAT TO MIGRATE — DECISION MATRIX

Read each source file, then apply this matrix:

| EoS Component | Migrate? | Reason |
|---|---|---|
| `EyeOfSauronOmniscient` — `scan()` / `scanFile()` | ✅ Core — adapt | Main orchestrator, works as pure function |
| `CharacterForensics` — invisible char detection | ✅ Migrate | Genuinely useful, security-relevant |
| `PatternPrecognition` — code patterns | ✅ Migrate selectively | Read it — take rules with clear signal, skip noisy ones |
| `BatchProcessor` — batch file processing | ✅ Adapt | Simple, useful, no external deps |
| `SauronDependencyGraph` | ✅ Evaluate | May replace the `madge` approach from original 5B spec |
| `TechnicalDebtCalculator` | ✅ Evaluate | If it produces a clean score, use it |
| `KaizenSnapshot` | ⚠️ Evaluate | Snapshot diffing — useful if lightweight |
| `PatternLearningEngine` | ❌ Skip | Too complex, Redis-dependent in spirit |
| `ScanProfileManager` / `PolicyViolationReporter` | ❌ Skip | Server-side concerns |
| Everything in `utils/Sauron*` (except DependencyGraph) | ❌ Skip | Report archiving, encryption, CI — not needed |
| `server/`, `cli/`, `reporters/` | ❌ Skip | Not needed |

---

## WHAT YOU ARE BUILDING

### New files in GregLite

```
app/lib/eos/
  index.ts            — public API: scan(projectPath, mode), scanFiles(paths), getHealthScore(report)
  engine.ts           — TypeScript port of EyeOfSauronOmniscient core (scan + scanFile logic)
  character.ts        — TypeScript port of CharacterForensics (invisible chars, encoding issues)
  patterns.ts         — TypeScript port of PatternPrecognition (selected rules only — see below)
  batch.ts            — TypeScript port of BatchProcessor
  debt.ts             — TypeScript port of TechnicalDebtCalculator (if clean) OR simple scoring
  deps.ts             — dependency cycle detection (SauronDependencyGraph or madge — pick best)
  fp-tracker.ts       — false positive DB, auto-suppression at 20% FP rate
  health-score.ts     — weighted 0-100 health score from scan report
  types.ts            — EoSScanResult, HealthIssue, HealthScore, ScanMode interfaces
```

### Pattern selection for `patterns.ts`

Read `PatternPrecognition.js` in full. For each rule, ask: does this produce a meaningful signal on TypeScript/React code without excessive noise? Migrate rules that clearly answer yes. **Do not migrate rules that detect problems primarily in vanilla JS** (e.g. `var` usage in a TS project where the compiler already catches it). Document every rule you migrate AND every rule you skip with a one-line reason in SPRINT_5A_COMPLETE.md.

### Public API

Regardless of internal structure, GregLite needs exactly this interface:

```typescript
export type ScanMode = 'quick' | 'deep';

export interface HealthIssue {
  ruleId: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  file: string;
  line?: number;
}

export interface EoSScanResult {
  healthScore: number;       // 0-100
  issues: HealthIssue[];
  filesScanned: number;
  durationMs: number;
  suppressed: string[];      // ruleIds suppressed due to FP rate
}

// Scan a project directory
export async function scan(projectPath: string, mode?: ScanMode): Promise<EoSScanResult>

// Scan specific files (used by Agent SDK gate — post-job check)
export async function scanFiles(filePaths: string[]): Promise<EoSScanResult>
```

### Severity mapping

EoS uses `APOCALYPSE / DANGER / WARNING / NOTICE`. Map to GregLite's simpler schema:

```typescript
const SEVERITY_MAP: Record<string, HealthIssue['severity']> = {
  APOCALYPSE: 'critical',
  DANGER: 'critical',
  WARNING: 'warning',
  NOTICE: 'info',
};
```

### Health score formula

```typescript
export function computeHealthScore(report: RawEoSReport): number {
  let score = 100;
  const critical = report.issues.filter(i => i.severity === 'critical').length;
  const warnings = report.issues.filter(i => i.severity === 'warning').length;
  const cycles = report.dependencyCycles ?? 0;

  score -= critical * 8;
  score -= warnings * 2;
  score -= cycles * 10;

  return Math.max(0, Math.min(100, score));
}
```

### False positive tracker

```typescript
// fp-tracker.ts
// When David dismisses a quality issue as a false positive, record it.
// Rules above 20% FP rate in last 100 occurrences are auto-suppressed.

export async function recordDismissal(ruleId: string): Promise<void>
export async function recordAcceptance(ruleId: string): Promise<void>
export async function getSuppressedRules(): Promise<string[]>
export async function getFPRate(ruleId: string): Promise<number>
```

KERNL table:
```sql
CREATE TABLE IF NOT EXISTS eos_fp_log (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  action TEXT CHECK(action IN ('dismissed', 'accepted')),
  file_path TEXT,
  logged_at INTEGER NOT NULL
);
```

### Wire into Agent SDK job completion

In `app/lib/agent-sdk/job-tracker.ts`, after a job completes, run EoS against the files the manifest touched:

```typescript
// After COMPLETED status set:
const touchedFiles = manifest.context.files?.map(f => f.path) ?? [];
if (touchedFiles.length > 0) {
  const result = await scanFiles(touchedFiles);
  await kernl.db.run(
    `UPDATE manifests SET result_report = json_set(result_report, '$.eos', ?) WHERE id = ?`,
    [JSON.stringify({ healthScore: result.healthScore, issueCount: result.issues.length }), manifest.id]
  );

  if (result.healthScore < 70 && manifest.quality_gates?.eos_required) {
    await setJobStatus(manifest.id, 'FAILED', `EoS health score ${result.healthScore}/100 — below threshold`);
    return;
  }
}
```

### Persist project health score to KERNL

After a full project scan, write the score to the projects table:

```typescript
await kernl.db.run(
  `UPDATE projects SET health_score = ?, last_eos_scan = ? WHERE id = ?`,
  [result.healthScore, Date.now(), projectId]
);
```

Add `eos_reports` table:
```sql
CREATE TABLE IF NOT EXISTS eos_reports (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  scanned_at INTEGER NOT NULL,
  health_score INTEGER NOT NULL,
  files_scanned INTEGER,
  critical_issues INTEGER DEFAULT 0,
  warning_issues INTEGER DEFAULT 0,
  dependency_cycles INTEGER DEFAULT 0,
  duration_ms INTEGER,
  full_report TEXT
);
```

### Schedule — when EoS runs

- After every Agent SDK job completion (on touched files only, fast)
- On background indexer 30-minute cycle if project not scanned in last 6 hours (full scan)
- Never during active Agent SDK sessions (check active job count first)

### Score < 70 → Decision Gate suggestion

```typescript
if (result.healthScore < 70) {
  // Surface as Cross-Context suggestion card (same mechanism as Phase 3)
  await surfaceEoSWarning(result, projectId, activeThreadId);
}
```

---

## CHECKPOINTING

Every 3 file writes: `npx tsc --noEmit` + `git add && git commit -m "sprint-5a(wip): [description]"`

---

## SESSION END

1. Zero errors, zero failures
2. Update `D:\Projects\GregLite\STATUS.md` — Sprint 5A complete
3. `git commit -m "sprint-5a: Eye of Sauron native integration, health scores, FP tracker"`
4. `git push`
5. Write `SPRINT_5A_COMPLETE.md`:
   - Every EoS rule migrated (and why)
   - Every EoS rule skipped (and why)
   - First health score on GregLite's own codebase
   - Scan duration on GregLite source
   - Any pattern that hit >20% FP rate immediately

---

## GATES CHECKLIST

- [ ] EoS source files read before writing any GregLite code
- [ ] `scan(projectPath)` returns `EoSScanResult` with real issues from EoS engine
- [ ] `scanFiles(paths)` works for targeted post-job checks
- [ ] Health score computed (0-100) and matches expected formula
- [ ] Health score persisted to KERNL `projects` table after full scan
- [ ] `eos_reports` table populated after scan
- [ ] `eos_fp_log` table created in KERNL
- [ ] Agent SDK job gate blocks COMPLETED when `eos_required: true` and score < 70
- [ ] Score < 70 produces suggestion card in context panel
- [ ] EoS never runs during active Agent SDK sessions
- [ ] Rule migration decisions documented in SPRINT_5A_COMPLETE.md
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm test:run` clean
- [ ] Commit pushed
