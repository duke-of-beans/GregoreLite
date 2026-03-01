# GREGLITE — SPRINT 2A EXECUTION BRIEF
## Agent SDK Integration + Job Queue UI
**Instance:** Parallel Workstream A (run simultaneously with 2B, 2C, 2D)
**Created:** March 1, 2026
**Project:** D:\Projects\GregLite\
**Phase 1 baseline:** TypeScript 0 errors, 24/24 tests, KERNL SQLite live at .kernl/greglite.db

---

## YOUR ROLE

Bounded execution worker. You are building the worker session infrastructure for GregLite — the "employees" layer that runs overnight jobs, code sessions, and doc tasks via the Claude Agent SDK. David is CEO. Execute as COO-level engineer. Zero debt, complete implementation.

---

## MANDATORY BOOTSTRAP

Load in order before writing any code:

1. `D:\Dev\CLAUDE_INSTRUCTIONS.md`
2. `D:\Dev\TECHNICAL_STANDARDS.md`
3. `D:\Projects\GregLite\DEV_PROTOCOLS.md`
4. `D:\Projects\GregLite\PROJECT_DNA.yaml`
5. `D:\Projects\GregLite\STATUS.md`
6. `D:\Projects\GregLite\BLUEPRINT_FINAL.md` — read §4.3 (Agent SDK) and §4.3.1 (manifest injection) specifically
7. `D:\Projects\GregLite\SPRINT_2A_AgentSDK.md` — your complete spec

Then verify baseline:
```powershell
cd D:\Projects\GregLite\app
npx tsc --noEmit
pnpm test:run
```
Both must be clean before you touch anything.

---

## AUTHORITY PROTOCOL — STOP WHEN:

- Same fix applied 3+ times
- Operation estimated >8 minutes without a checkpoint
- Critical decision not covered by the sprint blueprint
- You are about to build a queue, cache, or scheduler from scratch — check npm first (LEAN-OUT)
- TypeScript errors increase beyond baseline

Write a BLOCKED report with: what you were doing, what triggered the stop, what decision is needed.

---

## QUALITY GATES (ALL REQUIRED BEFORE COMMIT)

1. `npx tsc --noEmit` — zero new errors
2. `pnpm test:run` — zero failures
3. No mocks, stubs, or TODOs in production code
4. Every new module has at least one vitest test
5. STATUS.md updated
6. Conventional commit format

---

## WHAT YOU ARE BUILDING

### New files

```
app/lib/agent-sdk/
  index.ts          — public API: spawn(manifest), kill(jobId), status(jobId), list()
  manifest.ts       — TaskManifest builder and zod validator
  executor.ts       — wraps Anthropic SDK streaming, handles events
  job-tracker.ts    — writes job state transitions to KERNL manifests table
  cost-tracker.ts   — token usage → USD cost via pricing.ts (already in services/)
  config.ts         — per-session soft cap $2, daily hard cap $15
  types.ts          — TaskManifest, ResultReport, JobState, WorkloadProfile interfaces

app/components/jobs/
  JobQueue.tsx      — right panel, 25% width, list of active/pending jobs
  JobCard.tsx       — single job: title, status badge, task type, step count, live cost, kill button, expand → log tail
  ManifestBuilder.tsx — form to create a manifest from the strategic thread
  index.ts          — exports
```

### KERNL table required

The `manifests` table must already exist from Phase 1 (it's in BLUEPRINT §3.1). Verify it exists in `.kernl/greglite.db` before writing any job-tracker code. If it's missing, add the migration — do not assume.

Check:
```javascript
// Quick verify in node REPL
const db = require('better-sqlite3')('.kernl/greglite.db');
db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='manifests'").get();
```

If missing, add the table creation to `app/lib/kernl/schema.sql` and the KERNL init sequence.

### Manifest injection format

System prompt for every worker session — from BLUEPRINT §4.3.1:

```typescript
function buildAgentSystemPrompt(manifest: TaskManifest): string {
  return `You are a bounded execution worker operating inside Gregore Lite.

The following JSON is a SYSTEM CONTRACT. It is authoritative and non-negotiable.

Rules:
- Treat all fields as binding constraints.
- Success is defined ONLY by \`success_criteria\`.
- If goals conflict with constraints, constraints win.
- You may not infer additional scope.
- You may only modify files explicitly listed in the manifest.

--- BEGIN SYSTEM MANIFEST (JSON) ---
${JSON.stringify(manifest, null, 2)}
--- END SYSTEM MANIFEST ---

Execution Protocol:
- Execute deterministically. Do not emit chain-of-thought.
- Write files directly using provided tools.
- If blocked, stop and report precisely why.

Completion Protocol:
- Summarize changes made.
- List all modified files.
- Confirm which success criteria were met and which were not.`;
}
```

### Job state machine

```
SPAWNING → RUNNING → WORKING → VALIDATING → COMPLETED
                                           → FAILED
                                           → INTERRUPTED
```

Each transition writes a row update to the KERNL manifests table with timestamp.

### Concurrency

Max 8 parallel sessions. Priority: strategic > self_evolution > code/test > docs/research. In-memory priority queue for Phase 2 — no BullMQ yet, that's Phase 3. Session 9+ queued with position shown in UI.

### Cost caps

```typescript
// app/lib/agent-sdk/config.ts
export const AGENT_COST_CONFIG = {
  perSessionSoftCapUsd: 2.00,
  perSessionWarnAtUsd: 1.60,
  dailyHardCapUsd: 15.00,
};
```

Import `pricing.ts` from `app/lib/services/pricing.ts` (carried from Gregore) — do not rewrite pricing logic.

### JobQueue UI layout

Right panel, 25% width. Each JobCard shows:
- Title from manifest
- Status badge (color per state machine above)
- Task type icon
- Step count e.g. "3/8 tasks"
- Live cost ticker (updates as tokens stream)
- Kill button (active only when RUNNING or WORKING)
- Expand chevron → shows last 10 lines of execution log

### Important: 2E dependency

Sprint 2E (War Room) needs `TaskManifest` and `JobState` types from `app/lib/agent-sdk/types.ts`. Your first commit should include those types even if the full executor isn't wired yet. 2E can start building against that schema.

---

## CHECKPOINTING

Every 3 file writes:
1. `npx tsc --noEmit` — catch errors immediately
2. `git add && git commit -m "sprint-2a(wip): [what you just did]"`

Never accumulate more than 3–4 files before a type-check. TypeScript errors compound.

---

## SESSION END

When all gates pass:

1. `npx tsc --noEmit` — zero errors
2. `pnpm test:run` — zero failures
3. Update `D:\Projects\GregLite\STATUS.md` — mark Sprint 2A complete
4. Final commit: `git commit -m "sprint-2a: agent SDK integration, job queue UI"`
5. `git push`
6. Write `SPRINT_2A_COMPLETE.md` to `D:\Projects\GregLite\` with: what was built, decisions made, any deviations from blueprint, anything deferred

---

## GATES CHECKLIST

- [ ] Spawn a worker session from ManifestBuilder UI
- [ ] Job appears in JobQueue with SPAWNING status immediately
- [ ] Status transitions visible in real time (RUNNING → WORKING → COMPLETED)
- [ ] Cost captured and displayed on completion
- [ ] Result report written to KERNL manifests table
- [ ] Kill button terminates session and writes INTERRUPTED status
- [ ] `TaskManifest` and `JobState` types exported from `app/lib/agent-sdk/types.ts` (required by 2E)
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm test:run` clean
- [ ] Commit pushed

---

## ENVIRONMENT

- Project root: `D:\Projects\GregLite\`
- App dir: `D:\Projects\GregLite\app\`
- Package manager: pnpm
- KERNL DB: `D:\Projects\GregLite\app\.kernl\greglite.db`
- API key: already in `app\.env.local`
- Do NOT modify anything in `D:\Projects\Gregore\`
- Do NOT commit `.env.local`
