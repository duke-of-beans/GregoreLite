# GregLite — Sprint 5B Complete
## SHIM PatternLearner Integration + FP Feedback UI
**Date:** March 2, 2026
**Commit:** sprint-5b: PatternLearner integration, FP feedback UI
**Depends on:** Sprint 5A (EoS native module)

---

## What Was Built

### Part 1 — SHIM PatternLearner Migration

**`app/lib/shim/types.ts`**
Port of `HistoricalImprovement`, `Pattern`, `PredictionScore` from SHIM. Key change: `timestamp: Date` → `timestamp: number` (Unix ms) for consistency with KERNL's integer timestamps.

**`app/lib/shim/pattern-learner.ts`**
Full TypeScript port of `D:\Projects\SHIM\src\ml\PatternLearner.ts` with KERNL persistence added:
- Constructor calls `hydrate()` — loads `shim_patterns` and `shim_improvements` rows into memory on startup
- `recordImprovement()` writes to `shim_improvements`, then calls `updatePatterns()` + `persistPatterns()` (upsert transaction)
- All other methods (`learnPatterns`, `predictSuccess`, `getTopPatterns`, `getPatternStats`) identical to SHIM original
- `getPatternLearner()` singleton factory — lazy-init, process-wide instance
- `_resetPatternLearner()` exported for test isolation only

**`app/lib/shim/job-context.ts`**
Context extraction layer:
- `extractContext(manifest, eosResult)` — maps EoS scan result to PatternLearner context shape
- `extractContextFromScore(healthScore, fileCount)` — lightweight variant for pre-spawn use (no fresh scan available)
- Complexity proxy: `100 - healthScore`
- Maintainability proxy: `100 - warning_density * 10` (warnings per estimated line count)
- linesOfCode: `fileCount * 100` (rough estimate; `TaskManifestFile` has no `estimated_lines` field)

**`app/lib/shim/improvement-log.ts`**
Bridge between Agent SDK lifecycle and PatternLearner:
- `storeShimScoreBefore(manifestId, projectPath)` — looks up `projects.health_score` and writes to `manifests.shim_score_before` at spawn time
- `logPredictions(projectPath, fileCount)` — runs `predictSuccess` before spawn, logs top result if confidence > 0.7
- `recordJobImprovement(manifestRow, eosResult)` — computes before/after delta, calls `getPatternLearner().recordImprovement()` after COMPLETED

### Part 2 — FP Feedback UI

**`app/components/context/EoSIssueRow.tsx`**
- Renders severity dot, truncated message, short file path + line number
- Dismiss (×) button: fires `POST /api/eos/fp` with `{ ruleId, action: 'dismissed', filePath, projectId, line }`
- Optimistic local hide on success (`useState(dismissed)`)
- Button only visible on row hover (`group-hover:opacity-100`)

**Quality section in `ContextPanel.tsx`**
- Added below DecisionList divider, above status footer
- Shows health score badge with colour coding (success/cyan/warning/error)
- Renders up to 5 `EoSIssueRow` components with optimistic dismiss tracking
- Shows "+N more issues" count when there are more than 5
- Section is hidden when `state.eosSummary` is null (no scan yet)

**`app/app/api/eos/fp/route.ts`**
- `POST /api/eos/fp` — validates `{ ruleId, action, filePath, projectId, line? }`
- Calls `recordOccurrence({ projectId, ruleId, filePath, isFP: action === 'dismissed', line? })`
- Returns `{ ok: true }` or error JSON with 400/500

### Part 3 — Infrastructure Updates

**`schema.sql`** additions:
```sql
CREATE TABLE IF NOT EXISTS shim_patterns (id, description, frequency, success_rate, average_impact, contexts, updated_at)
CREATE TABLE IF NOT EXISTS shim_improvements (id, pattern, complexity, maintainability, lines_of_code, modification_type, impact_score, success, complexity_delta, maintainability_delta, recorded_at)
CREATE INDEX idx_shim_improvements_pattern
ALTER TABLE manifests ADD COLUMN IF NOT EXISTS shim_score_before REAL DEFAULT NULL
```

**`eos/index.ts`** — added `persistScanReport(projectId, result, mode)`:
- Replaces bare `persistHealthScore` in job-tracker
- Writes `projects.health_score + last_eos_scan` AND inserts row into `eos_reports`
- `eos_reports` is now populated — context panel can display latest issues

**`agent-sdk/job-tracker.ts`** updates:
- `ManifestRow` interface gains `shim_score_before: number | null`
- COMPLETED path calls `persistScanReport` (was `persistHealthScore`) then `recordJobImprovement`

**`agent-sdk/executor.ts`** updates:
- After `insertManifest`: calls `storeShimScoreBefore` and `logPredictions` (both synchronous, non-blocking)

**`lib/context/types.ts`** — `ContextPanelState` gains `eosSummary: EoSHealthSummary | null`

**`app/api/context/route.ts`** — queries latest `eos_reports` row for active project, populates `eosSummary`

---

## MLPredictor Decision

`D:\Projects\SHIM\src\ml\MLPredictor.ts` was explicitly NOT migrated. It is a simulation using `Math.random()` with no real learning logic. Migrating a random number generator would add noise to GregLite's quality layer with zero informational value. PatternLearner's actual frequency/success-rate model is the production component.

---

## Context Mapping Decisions

| PatternLearner field | Source | Rationale |
|---------------------|--------|-----------|
| `complexity` | `100 - eosResult.healthScore` | Inverse of health score — higher score = simpler codebase |
| `maintainability` | Warning density formula | Warnings per line are a direct maintainability signal |
| `linesOfCode` | `fileCount × 100` | `TaskManifestFile` has no `estimated_lines`; 100 lines/file is a reasonable default |
| `linesOfCode` in improvement-log | `0` | `ManifestRow` doesn't carry the file list; future iteration can improve |

---

## Gates

- [x] `PatternLearner` migrated — no external deps, KERNL-persisted
- [x] `MLPredictor` NOT migrated — documented above
- [x] `shim_patterns` and `shim_improvements` tables in schema.sql
- [x] PatternLearner hydrates from KERNL on construction
- [x] `recordImprovement` called after every COMPLETED job (after EoS scan)
- [x] `predictSuccess` called before job spawn, top result logged if confidence > 0.7
- [x] `shim_score_before` stored on manifest at spawn time
- [x] EoS issue rows visible in Quality section of context panel
- [x] Dismiss (×) fires `POST /api/eos/fp`
- [x] `getSuppressedRules()` returns rules after >20% FP rate (verified in 5A tests)
- [x] Suppressed rules excluded from next EoS scan (fp-tracker handles this)
- [x] `npx tsc --noEmit` — 0 errors
- [x] `pnpm test:run` — 553/553 passing (29 test files)
- [x] Commit pushed
