# SPRINT 11.0 + 11.1 COMBINED — CLEANUP & SDK STUBS
# Cowork Execution Brief
# Created: March 4, 2026
# Scope: 14 tasks across 2 sprints (merged for efficiency)
# Time estimate: Single Cowork session
# DAVID ACTION REQUIRED: Phase 8 file audit (Task 1) — see bottom of this file

---

## CONTEXT

You are working on GregLite, a Tauri + Next.js 16 + React 19 desktop cognitive operating environment.

**Project path:** D:\Projects\GregLite\app
**Git repo root:** D:\Projects\GregLite
**Key docs:**
- D:\Projects\GregLite\SPRINT_ROADMAP.md — full sprint details
- D:\Projects\GregLite\STATUS.md — current state
- D:\Projects\GregLite\FEATURE_BACKLOG.md — gap analysis

**Current state:** Sprint 10.9 complete. 890 tests passing. tsc clean. Dev server runs on localhost:3000.

**This sprint combines Sprint 11.0 (cleanup) and Sprint 11.1 (Agent SDK stub completion) since both have zero dependencies and can execute sequentially in one session.**

---

## WAVE 1 — ROUTE CONSOLIDATION (Sprint 11.0, Tasks 2-4)

### Task 2: Remove /api/conversations routes

The `/api/conversations` routes use a broken ConversationRepository layer. `/api/threads` routes use KERNL directly and are correct.

1. Search ALL components and lib files for any `fetch` calls to `/api/conversations`:
   ```
   findstr /s /r "api/conversations" app\components\*.tsx app\components\*.ts lib\*.ts lib\*.tsx
   ```
2. For any consumer found, redirect the fetch URL to `/api/threads` equivalent
3. Delete `app/api/conversations/route.ts`
4. Delete `app/api/conversations/[id]/route.ts`
5. Verify no remaining imports of ConversationRepository from any component

### Task 3: Audit /api/jobs vs /api/agent-sdk/jobs

Both route trees exist. Determine which is canonical:

1. Search all components for consumers:
   ```
   findstr /s /r "api/jobs" app\components\*.tsx app\components\*.ts lib\*.ts
   ```
2. `/api/agent-sdk/jobs` has full CRUD + kill/merge/restart/supersede/unblock — this is likely canonical
3. If `/api/jobs` is a simplified alias or duplicate, remove it
4. If `/api/jobs` has unique consumers, redirect them to `/api/agent-sdk/jobs`
5. Update any hardcoded URLs in components

### Task 4: Remove ConversationRepository if unused

After Task 2, check if `lib/database/connection.ts` is still imported anywhere:

1. `findstr /s /r "connection\|ConversationRepository\|getDatabase.*connection\|gregore\.db" app\*.ts app\*.tsx lib\*.ts lib\*.tsx` (exclude node_modules)
2. If `connection.ts` has no remaining consumers, delete `lib/database/connection.ts`
3. Delete `lib/database/` directory if it's empty after removal
4. Remove any `gregore.db` references — KERNL uses `greglite.db`

**IMPORTANT:** `lib/kernl/database.ts` has its own `getDatabase()` — make sure you're only removing the ConversationRepository one in `lib/database/`, NOT the KERNL one.

---

## WAVE 2 — DEAD CODE CLEANUP (Sprint 11.0, Tasks 5-7)

### Task 5: Clean decision gate dead stubs

File: `lib/decision-gate/trigger-detector.ts`

Three functions are dead code — they always return false and were replaced by Haiku inference in `analyze()`:
- `detectHighTradeoff()` (~line 196)
- `detectMultiProject()` (~line 207)
- `detectLargeEstimate()` (~line 218)

1. Read `lib/decision-gate/index.ts` and confirm `analyze()` does NOT call these 3 functions
2. If confirmed dead: remove the 3 functions from `trigger-detector.ts`
3. Remove their exports from `trigger-detector.ts` if exported
4. Remove any imports of them from `index.ts`
5. Update comments in `lib/decision-gate/types.ts` that say `[STUB — 4B]` — change to a note that Haiku inference replaced these

### Task 6: Update stale Sprint reference comments

Search for comments referencing completed sprints with inaccurate status:

1. In `lib/agent-sdk/failure-modes.ts`: change `// stub — Phase 7G implements this` on `detectShimLoop()` to `// STUB — see Sprint 11.1 for implementation`
2. In `lib/agent-sdk/tool-injector.ts`: change all `(NOT IMPLEMENTED — available in Sprint 7G)` descriptions to `(NOT IMPLEMENTED — see Sprint 11.1)`
3. In `lib/agent-sdk/permission-config.ts`: update `[STUB → 7G]` comments to `[STUB → Sprint 11.1]`
4. In `lib/agent-sdk/query.ts`: update Sprint 7G references
5. Remove any `// Sprint 4B` references that pointed to the now-deleted stub functions (from Task 5)
6. Search broadly: `findstr /s /r /i "Sprint.7G\|STUB.*7G\|7G.*stub" lib\agent-sdk\*.ts` and update all hits

### Task 7: Remove MORNING_BRIEFING.md

```
del D:\Projects\GregLite\MORNING_BRIEFING.md
```

This is a Phase 1 session handoff doc from March 1, 2026. Morning briefings are auto-generated in the app now.

---

## WAVE 3 — AGENT SDK STUB COMPLETION (Sprint 11.1, Tasks 1-5)

### Task S11.1-1: Implement test_runner tool

Create new file: `lib/agent-sdk/tools/test-runner.ts`

```typescript
// Runs `pnpm test:run` in the project directory.
// Parses vitest output for pass/fail counts and failure details.
// Returns structured result.

interface TestResult {
  passed: number;
  failed: number;
  total: number;
  duration_ms: number;
  failures: Array<{ test: string; error: string }>;
}
```

Implementation:
1. Use `execFileSync` (NOT `execSync`) to run `pnpm test:run` in the manifest's `project_path`
2. Parse vitest output — look for the summary line like `Tests  24 passed (24)` or `Tests  2 failed | 22 passed (24)`
3. For failures, extract test name + error message from the output
4. Timeout: 120 seconds
5. Return `TestResult` as JSON string

Then in `lib/agent-sdk/tool-injector.ts`:
- Replace the `test_runner` stub definition (remove `_stub: true`)
- Point to the real implementation
- Wire execution in `lib/agent-sdk/query.ts` (replace the `isStubTool` NOT_IMPLEMENTED branch for this tool name)

Write tests in `lib/agent-sdk/__tests__/test-runner.test.ts`:
- Mock `execFileSync` returning passing output
- Mock `execFileSync` returning failing output with 2 failures
- Mock `execFileSync` throwing (timeout) — returns error result

### Task S11.1-2: Implement shim_readonly_audit tool

Create new file: `lib/agent-sdk/tools/shim-readonly-audit.ts`

```typescript
// Runs EoS engine scan on target path, read-only.
// Returns health score + issues without modifying anything.

interface AuditResult {
  healthScore: number;
  grade: string;
  fileCount: number;
  issues: Array<{ rule: string; severity: string; file: string; line?: number; message: string }>;
}
```

Implementation:
1. Import `scanFiles` from `lib/eos/engine.ts` (or the equivalent scan entry point)
2. Read the target path, run the scan
3. Return structured result — score, grade (A/B/C/D from scoreClass), issues list
4. No modifications — read-only scan only

Wire in tool-injector.ts and query.ts same pattern as Task S11.1-1.

Tests: scan on a known file, empty directory, nonexistent path returns error.

### Task S11.1-3: Implement markdown_linter tool

Create new file: `lib/agent-sdk/tools/markdown-linter.ts`

```typescript
// Simple rule-based markdown linter. No external dependencies.
// Checks: missing H1, inconsistent list markers, trailing whitespace,
// missing blank lines before headers, broken relative links.

interface LintResult {
  violations: Array<{ file: string; line: number; rule: string; message: string }>;
  fileCount: number;
}
```

Implementation — simple rule-based (no external dep):
1. Read all `.md` files in target path
2. Rules:
   - `no-missing-h1`: File should have exactly one `# ` header
   - `consistent-list-markers`: Don't mix `*` and `-` in same file
   - `no-trailing-whitespace`: Lines shouldn't end with spaces
   - `blank-before-header`: Headers need a blank line above them
3. Return violations array

Wire in tool-injector.ts and query.ts.
Tests: clean file returns empty violations, file with issues returns correct violations.

### Task S11.1-4: Implement kernl_search_readonly tool

Create new file: `lib/agent-sdk/tools/kernl-search.ts`

```typescript
// Searches KERNL FTS5 index, read-only. Returns matching messages.

interface SearchResult {
  results: Array<{ threadId: string; messageId: string; content: string; rank: number }>;
  query: string;
  totalResults: number;
}
```

Implementation:
1. Import `getDatabase` from `lib/kernl/database.ts`
2. Query `messages_fts` FTS5 table: `SELECT * FROM messages_fts WHERE messages_fts MATCH ? ORDER BY rank LIMIT ?`
3. Join back to `messages` table for thread_id
4. Return top N results (default 10, configurable via `max_results` input)
5. Read-only — no writes

Wire in tool-injector.ts and query.ts.
Tests: mock getDatabase, verify FTS query runs, empty results, special characters escaped.

### Task S11.1-5: Implement detectShimLoop()

File: `lib/agent-sdk/failure-modes.ts` — replace the stub at ~line 107.

Spec: 3 consecutive SHIM calls on the same file with no score improvement → return true (BLOCKED).

```typescript
export function detectShimLoop(
  shimCallHistory: Array<{ file: string; score: number }>,
): boolean {
  // Group by file, look for 3+ consecutive calls with score delta <= 0
  // "Consecutive" means the last 3 entries for the same file
  // "No improvement" means each score is <= the previous score for that file
}
```

Implementation:
1. Filter history to entries for the most recent file
2. If fewer than 3 entries for that file, return false
3. Take the last 3 entries for that file
4. If score[1] <= score[0] AND score[2] <= score[1], return true
5. Otherwise return false

Wire into `lib/agent-sdk/query.ts`:
- After each `shim_check` tool call completes, append `{ file, score }` to a session-level history array
- Call `detectShimLoop(history)` — if true, transition job to BLOCKED, surface escalation

Tests:
- No loop: scores improve (50 → 60 → 70) → false
- Loop detected: flat scores (50 → 50 → 50) → true
- Loop detected: declining scores (50 → 45 → 40) → true
- Mixed files: 3 calls on file A improving, 3 calls on file B flat → true (B triggers)
- Fewer than 3 calls → false

---

## WAVE 4 — VERIFICATION & COMMIT

### Task FINAL: Full verification

1. `npx tsc --noEmit` — must be 0 errors
2. `pnpm test:run` — all existing tests pass + new tests pass
3. Verify:
   - No remaining `_stub: true` entries in tool-injector.ts (all 4 stubs replaced)
   - `isStubTool()` returns false for test_runner, shim_readonly_audit, markdown_linter, kernl_search_readonly
   - `/api/conversations` routes deleted
   - `/api/jobs` consolidated (or documented why both exist)
   - No `detectHighTradeoff`/`detectMultiProject`/`detectLargeEstimate` functions remain
   - No `Sprint 7G` stub references remain
   - MORNING_BRIEFING.md deleted
4. Git commit:
   ```
   git add -A
   git commit -m "feat: Sprint 11.0+11.1 — cleanup, route consolidation, Agent SDK stubs implemented"
   ```

---

## ⚠️ DAVID MANUAL ACTION — Phase 8 File Audit

**Do this BEFORE or AFTER the Cowork session — does not block any tasks above.**

BLUEPRINT_FINAL.md claims Phase 8 shipped these items. No Phase 8 commits are visible in git log. Check if these files/features actually exist:

1. **build-installer.bat** — Does `D:\Projects\GregLite\build-installer.bat` exist? Is it functional?
2. **tauri.conf.json updater** — Does `app/src-tauri/tauri.conf.json` contain an `updater` section?
3. **First-run onboarding** — Search for an onboarding component: `findstr /s /r /i "onboarding\|first.run\|setup.wizard" app\components\*.tsx`
4. **execFileSync** — Are all shell executions using `execFileSync` (not `execSync`)? `findstr /s execSync lib\*.ts` should return 0 results (or only in comments)
5. **HMAC auth** — Does `/api/agent-sdk/jobs/[id]/merge/route.ts` verify an HMAC signature?
6. **Keytar/credential manager** — `findstr /s /r /i "keytar\|credential\|keychain" lib\*.ts`

**If items are MISSING:** Create a `PHASE_8_GAPS.md` file listing what needs to be built. These become Sprint 11.0.5 tasks.
**If items EXIST:** Update BLUEPRINT_FINAL.md to change Phase 8 from ⚠️ back to ✅.

---

## FILES LIKELY TOUCHED

Sprint 11.0:
- DELETE: `app/api/conversations/route.ts`
- DELETE: `app/api/conversations/[id]/route.ts`
- DELETE or REDIRECT: `app/api/jobs/route.ts`, `app/api/jobs/[id]/route.ts`
- DELETE (if unused): `lib/database/connection.ts`, `lib/database/` directory
- EDIT: `lib/decision-gate/trigger-detector.ts` (remove 3 dead functions)
- EDIT: `lib/decision-gate/types.ts` (update comments)
- EDIT: `lib/agent-sdk/failure-modes.ts` (update comment)
- EDIT: `lib/agent-sdk/tool-injector.ts` (update comments)
- EDIT: `lib/agent-sdk/permission-config.ts` (update comments)
- EDIT: `lib/agent-sdk/query.ts` (update comments)
- DELETE: `MORNING_BRIEFING.md`
- Any components with `/api/conversations` fetch calls

Sprint 11.1:
- NEW: `lib/agent-sdk/tools/test-runner.ts`
- NEW: `lib/agent-sdk/tools/shim-readonly-audit.ts`
- NEW: `lib/agent-sdk/tools/markdown-linter.ts`
- NEW: `lib/agent-sdk/tools/kernl-search.ts`
- NEW: `lib/agent-sdk/__tests__/test-runner.test.ts`
- NEW: `lib/agent-sdk/__tests__/shim-readonly-audit.test.ts`
- NEW: `lib/agent-sdk/__tests__/markdown-linter.test.ts`
- NEW: `lib/agent-sdk/__tests__/kernl-search.test.ts`
- EDIT: `lib/agent-sdk/tool-injector.ts` (replace 4 stubs with real definitions)
- EDIT: `lib/agent-sdk/query.ts` (wire real tool execution, detectShimLoop)
- EDIT: `lib/agent-sdk/failure-modes.ts` (real detectShimLoop implementation)

## NON-NEGOTIABLE RULES

1. Every file you create or edit MUST pass `npx tsc --noEmit` with 0 errors
2. Do NOT use `execSync` — always `execFileSync` (security)
3. Do NOT create mock/stub implementations — every tool must do real work
4. Do NOT modify files outside the listed scope without documenting why
5. All new code must have tests
6. Use `cmd` shell (not PowerShell) for all shell commands — PowerShell has GREGORE profile issues
7. Wrap all DB migrations in try/catch for idempotent re-runs
8. Fire-and-forget patterns: tool errors are logged, never crash the app
