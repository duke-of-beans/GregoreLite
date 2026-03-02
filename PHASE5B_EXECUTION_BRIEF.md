# GREGLITE — SPRINT 5B EXECUTION BRIEF
## Quality Layer — SHIM Pattern Learner Integration + FP UI
**Instance:** Sequential after 5A
**Created:** March 1, 2026
**Project:** D:\Projects\GregLite\
**Depends on:** Sprint 5A complete (EoS native module live)

---

## YOUR ROLE

Bounded execution worker. You are migrating SHIM's PatternLearner into GregLite and building the false positive feedback UI for EoS issues. The PatternLearner is a genuine learning engine — it tracks which code improvement patterns actually succeeded across Agent SDK sessions and predicts which future changes are likely to work. David is CEO. Execute as COO-level engineer. Zero debt, complete implementation.

---

## CRITICAL: READ FIRST

Before writing anything, read:

```
D:\Projects\SHIM\src\ml\PatternLearner.ts    ← migrate this (real, useful)
D:\Projects\SHIM\src\ml\MLPredictor.ts       ← do NOT migrate this (stub with Math.random())
```

The `MLPredictor` is a simulation. Skip it entirely. The `PatternLearner` is production-quality and migrates cleanly.

Also read `D:\Projects\GregLite\SPRINT_5A_COMPLETE.md` — understand what EoS rules were migrated and what the FP tracker schema looks like before building on top of it.

---

## MANDATORY BOOTSTRAP

Load in order:

1. `D:\Dev\CLAUDE_INSTRUCTIONS.md`
2. `D:\Dev\TECHNICAL_STANDARDS.md`
3. `D:\Projects\GregLite\DEV_PROTOCOLS.md`
4. `D:\Projects\GregLite\STATUS.md`
5. `D:\Projects\GregLite\BLUEPRINT_FINAL.md` — §11 (Quality Layer)
6. `D:\Projects\GregLite\SPRINT_5A_COMPLETE.md`

Baseline check:
```powershell
cd D:\Projects\GregLite\app
npx tsc --noEmit
pnpm test:run
```

---

## AUTHORITY PROTOCOL — STOP WHEN:

- PatternLearner's context schema (complexity, maintainability, linesOfCode) doesn't map cleanly to GregLite's manifest/job context — design the mapping before building
- FP feedback UI introduces a client/server boundary issue similar to the `fs` error from Phase 4 — stop and resolve before continuing
- Same fix 3+ times

---

## QUALITY GATES

1. `npx tsc --noEmit` — zero new errors
2. `pnpm test:run` — zero failures
3. PatternLearner records improvement outcomes from Agent SDK job completions
4. `predictSuccess` runs before a manifest is submitted and results are logged
5. FP dismiss button wired on EoS issues in context panel
6. Auto-suppression verified: rule with 20+ dismissals in 100 events → appears in `getSuppressedRules()`
7. STATUS.md updated

---

## PART 1 — PATTERN LEARNER MIGRATION

### New files

```
app/lib/shim/
  pattern-learner.ts   — TypeScript port of SHIM's PatternLearner (direct copy + adapt)
  job-context.ts       — extracts PatternLearner context from GregLite manifest/job
  improvement-log.ts   — persists improvement records to KERNL
  types.ts             — HistoricalImprovement, Pattern, PredictionScore (from SHIM, adapted)
```

### Migration approach

The `PatternLearner` class is clean TypeScript with no external dependencies. Copy the interfaces and class directly into `pattern-learner.ts` with minimal changes:

- Rename nothing — the types (`HistoricalImprovement`, `Pattern`, `PredictionScore`) are clear
- Change `Date` fields to `number` (Unix timestamps) for consistency with the rest of GregLite
- The `patterns` Map should be persisted to KERNL between sessions (see below)

### KERNL persistence

PatternLearner's `patterns` Map is in-memory in the original. GregLite needs it to survive restarts. Add a `shim_patterns` table:

```sql
CREATE TABLE IF NOT EXISTS shim_patterns (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  frequency INTEGER DEFAULT 0,
  success_rate REAL DEFAULT 0,
  average_impact REAL DEFAULT 0,
  contexts TEXT,       -- JSON array of context objects
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS shim_improvements (
  id TEXT PRIMARY KEY,
  pattern TEXT NOT NULL,
  complexity REAL,
  maintainability REAL,
  lines_of_code INTEGER,
  modification_type TEXT,
  impact_score REAL,
  success INTEGER DEFAULT 0,    -- 0 or 1
  complexity_delta REAL,
  maintainability_delta REAL,
  recorded_at INTEGER NOT NULL
);
```

On init, hydrate the PatternLearner from these tables. After every `recordImprovement()` call, persist the updated patterns back.

### Context extraction — job to PatternLearner

```typescript
// job-context.ts
export function extractContext(manifest: TaskManifest, shimResult: EoSScanResult): {
  complexity: number;
  maintainability: number;
  linesOfCode: number;
} {
  // complexity: proxy via issue count from EoS (0-100 scale, inverted: 100 - healthScore)
  const complexity = 100 - shimResult.healthScore;

  // maintainability: proxy via warning density (warnings per 100 lines)
  const warnings = shimResult.issues.filter(i => i.severity === 'warning').length;
  const totalLines = shimResult.filesScanned * 200; // rough estimate
  const maintainability = Math.max(0, 100 - (warnings / totalLines * 1000));

  // linesOfCode: from manifest files list
  const linesOfCode = manifest.context.files?.reduce((sum, f) => sum + (f.estimated_lines ?? 100), 0) ?? 0;

  return { complexity, maintainability, linesOfCode };
}
```

### Wire into job lifecycle

**Before job spawn** — predict success and log:

```typescript
// In ManifestBuilder or job spawner, before calling spawn():
const predictions = patternLearner.predictSuccess(extractContext(manifest, lastEoSResult));
if (predictions.length > 0 && predictions[0].confidence > 0.7) {
  logger.info('[shim] pattern prediction', {
    pattern: predictions[0].pattern,
    confidence: predictions[0].confidence,
    expectedImpact: predictions[0].expectedImpact
  });
  // Surface as context in the manifest system prompt? Optional — log for now
}
```

**After job COMPLETED** — record improvement:

```typescript
// In job-tracker.ts after COMPLETED, after EoS scan:
const beforeScore = manifest.shim_score_before ?? 50;
const afterScore = eosResult.healthScore;

await patternLearner.recordImprovement({
  id: nanoid(),
  pattern: manifest.task.taskType ?? 'code',
  context: extractContext(manifest, eosResult),
  modification: {
    type: manifest.task.taskType ?? 'unknown',
    impactScore: afterScore - beforeScore,
  },
  outcome: {
    success: afterScore >= beforeScore,
    complexityDelta: -(afterScore - beforeScore),
    maintainabilityDelta: afterScore - beforeScore,
  },
  timestamp: Date.now(),
});
```

Store `shim_score_before` on the manifest at spawn time (the EoS score of the project at that moment). After completion, compare.

---

## PART 2 — FALSE POSITIVE FEEDBACK UI

Sprint 5A built `fp-tracker.ts` but left the dismiss button unwired in the UI. Wire it now.

### Where EoS issues are displayed

EoS scan results surface as suggestion cards via the Cross-Context mechanism (score < 70 → suggestion). They also appear in a new "Quality" section of the context panel when a scan completes.

### Quality section in context panel

Add below the KERNL status block in `ContextPanel.tsx`:

```tsx
{/* Quality section — shows after EoS scan */}
{eosResult && (
  <div className="context-section quality-section">
    <div className="section-header">
      <span>Quality</span>
      <span className={`health-score ${scoreClass(eosResult.healthScore)}`}>
        {eosResult.healthScore}/100
      </span>
    </div>
    {eosResult.issues.slice(0, 5).map(issue => (
      <EoSIssueRow key={issue.ruleId + issue.file + issue.line} issue={issue} />
    ))}
    {eosResult.issues.length > 5 && (
      <span className="muted">{eosResult.issues.length - 5} more — click to expand</span>
    )}
  </div>
)}
```

### EoSIssueRow component

```tsx
// app/components/context/EoSIssueRow.tsx
export function EoSIssueRow({ issue }: { issue: HealthIssue }) {
  const handleDismiss = async () => {
    await fetch('/api/eos/fp', {
      method: 'POST',
      body: JSON.stringify({ ruleId: issue.ruleId, action: 'dismissed', filePath: issue.file }),
    });
  };

  return (
    <div className="eos-issue-row">
      <span className={`severity-dot ${issue.severity}`} />
      <span className="issue-message">{issue.message}</span>
      <span className="issue-file">{shortPath(issue.file)}</span>
      <button className="fp-dismiss" onClick={handleDismiss} title="Mark as false positive">
        ×
      </button>
    </div>
  );
}
```

### API route for FP feedback

```typescript
// app/app/api/eos/fp/route.ts
export async function POST(req: Request) {
  const { ruleId, action, filePath } = await req.json();
  if (action === 'dismissed') {
    await recordDismissal(ruleId, filePath);
  } else {
    await recordAcceptance(ruleId, filePath);
  }
  return new Response(JSON.stringify({ ok: true }));
}
```

---

## CHECKPOINTING

Every 3 file writes: `npx tsc --noEmit` + `git add && git commit -m "sprint-5b(wip): [description]"`

---

## SESSION END

1. Zero errors, zero failures
2. Update `D:\Projects\GregLite\STATUS.md` — Sprint 5B complete
3. `git commit -m "sprint-5b: PatternLearner integration, FP feedback UI"`
4. `git push`
5. Write `SPRINT_5B_COMPLETE.md`:
   - PatternLearner tables populated after first test job
   - Any context mapping decisions (complexity/maintainability proxy choices)
   - FP UI tested manually — dismiss button fires API correctly
   - Any issues with client/server boundary

---

## GATES CHECKLIST

- [ ] `PatternLearner` migrated to `app/lib/shim/pattern-learner.ts` — no external deps
- [ ] `MLPredictor` explicitly NOT migrated (documented in SPRINT_5B_COMPLETE.md)
- [ ] `shim_patterns` and `shim_improvements` tables created in KERNL
- [ ] PatternLearner hydrates from KERNL on boot
- [ ] `recordImprovement` called after every Agent SDK job COMPLETED
- [ ] `predictSuccess` called before job spawn, logged to console
- [ ] `shim_score_before` stored on manifest at spawn time
- [ ] EoS issue rows visible in context panel quality section
- [ ] Dismiss (×) button fires POST `/api/eos/fp`
- [ ] `getSuppressedRules()` returns rules after 20 dismissals (verify with test)
- [ ] Suppressed rules excluded from next EoS scan result
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm test:run` clean
- [ ] Commit pushed
