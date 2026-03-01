# GREGLITE — PHASE 1 EXECUTION BRIEF
## Cowork Agent Session | Sprints 1A through 1E
**Created:** March 1, 2026  
**Project:** D:\Projects\GregLite\  
**Executor:** Claude Agent SDK (autonomous)  
**Estimated duration:** 5 sequential sprints, ~4–6 hours total

---

## YOUR ROLE

You are a bounded execution worker for the GregLite project. You are building a premier AI development environment — a direct Anthropic API cockpit that replaces Claude Desktop. David is CEO. You are executing as COO-level engineer. Be precise, complete, and zero-debt.

---

## MANDATORY BOOTSTRAP (DO THIS FIRST — NO EXCEPTIONS)

Before writing a single line of code, load these files in order:

1. `D:\Dev\CLAUDE_INSTRUCTIONS.md` — session protocol, authority triggers, quality gates
2. `D:\Dev\TECHNICAL_STANDARDS.md` — locked library choices, forbidden anti-patterns
3. `D:\Projects\GregLite\DEV_PROTOCOLS.md` — GregLite-specific extracts and fallback rules
4. `D:\Projects\GregLite\PROJECT_DNA.yaml` — project identity and constraints
5. `D:\Projects\GregLite\STATUS.md` — current state
6. `D:\Projects\GregLite\BLUEPRINT_FINAL.md` — full architecture spec

If any of files 1–3 cannot be loaded, STOP and report which file failed. Do not proceed with assumptions.

After loading, run:
```powershell
cd D:\Projects\GregLite\app
npx tsc --noEmit
```

Note any existing errors. These are your baseline — do not introduce new ones.

---

## AUTHORITY PROTOCOL — STOP AND SURFACE WHEN:

- Same fix applied 3+ times (whack-a-mole)
- Any operation will take >8 minutes without a checkpoint
- A critical architectural decision arises that isn't covered by the sprint blueprints
- A quality violation is unavoidable (mock, stub, placeholder)
- You are about to build a queue, cache, scheduler, or rate limiter from scratch (LEAN-OUT: check npm first)
- TypeScript errors increase beyond baseline after your changes

When stopped, write a clear BLOCKED report to the session output with: what you were doing, what triggered the stop, and what decision is needed from David.

---

## QUALITY GATES — NON-NEGOTIABLE

These apply to every sprint before its commit:

1. `npx tsc --noEmit` — zero new TypeScript errors
2. `pnpm test:run` — zero test failures
3. No mocks, stubs, or TODOs in production code
4. Every new module has at least one vitest test
5. STATUS.md updated with what was completed
6. Git commit in conventional format: `sprint-Nx: description`

---

## CHECKPOINTING PROTOCOL

Every 2–3 file writes:
1. Run `npx tsc --noEmit` — catch errors early, not at commit time
2. Git add + commit with descriptive message
3. Note decisions made since last checkpoint

Never batch more than 3–4 files before a type-check. Errors compound fast.

---

## THE SPRINTS

Execute in strict order. Do not start the next sprint until the current sprint's gates all pass.

---

### SPRINT 1A — Foundation Cleanup + Working Chat

**Read first:** `D:\Projects\GregLite\SPRINT_1A_Foundation.md`

**Summary:** The chat route currently imports `OrchestrationExecutor` from a deleted module — the app cannot actually send messages. Replace it with a direct Anthropic SDK call. Simplify `ChatResponse` type. Delete all Gregore-specific components that have no place in GregLite.

**Key deliverable:** Type a message in the UI, get a real Claude response back.

**Files to touch:**
- `app/app/api/chat/route.ts` — full rewrite (spec in sprint blueprint)
- `app/lib/api/types.ts` — simplify ChatResponse (spec in sprint blueprint)
- `app/lib/__tests__/integration/` — delete all 5 files (reference deleted modules)
- `app/components/chat/` — delete: ReceiptFooter, ReceiptPreferencePrompt, OrchestrationDetail, BudgetDisplay, BudgetPreferencePrompt, MemoryIndicator, MemoryModal, MemoryShimmer, OverrideModal
- `app/components/chat/index.ts` — update exports to match remaining files
- `app/lib/hooks/useBudgetPreference.ts` — delete
- `app/lib/hooks/useReceiptPreference.ts` — delete
- `app/lib/types/cognitive.ts` — delete (AOT types)

**Commit gate:** `sprint-1a: clean chat route, working strategic thread`

---

### SPRINT 1B — KERNL Native Module

**Read first:** `D:\Projects\GregLite\SPRINT_1B_KERNL.md`

**Summary:** Build the KERNL persistence layer as a TypeScript module backed by SQLite. Sessions, messages, decisions, workstreams, manifests — everything that must survive process death. No MCP server. Direct module imports only.

**Key deliverable:** Messages persist to SQLite. App restart → data still there.

**New directory:** `app/lib/kernl/` with: `index.ts`, `database.ts`, `schema.sql`, `session-manager.ts`, `decision-store.ts`, `workstream.ts`, `types.ts`

**Storage path:** `process.env.APPDATA + '\\greglite\\kernl.db'` — create directory if not exists.

**Schema:** All tables from BLUEPRINT_FINAL.md §3.1. WAL mode mandatory: `PRAGMA journal_mode=WAL`.

**Wire into chat route:** After assistant response, append both user and assistant messages to KERNL via the module API.

**Commit gate:** `sprint-1b: KERNL native module, SQLite persistence`

---

### SPRINT 1C — Continuity Checkpointing

**Read first:** `D:\Projects\GregLite\SPRINT_1C_Continuity.md`

**Summary:** Every assistant response writes a diff checkpoint to SQLite. On app restart, the last active session is automatically restored into UI state. This is the crash survivability guarantee.

**Key deliverable:** Kill `pnpm dev` mid-conversation. Restart. All messages visible without user action.

**New directory:** `app/lib/continuity/` with: `index.ts`, `checkpoint.ts`, `diff.ts`, `types.ts`

**Add to KERNL schema:** `checkpoints` table (thread_id, diff_json, written_at).

**Checkpoint timing:** Every response, non-blocking. Target <50ms write time.

**Boot restore:** In `app/app/page.tsx` or a layout provider — on mount, call `continuity.getLastActiveThread()`, restore if found, populate UI state before first render.

**Commit gate:** `sprint-1c: continuity checkpointing, crash recovery`

---

### SPRINT 1D — Bootstrap Sequence

**Read first:** `D:\Projects\GregLite\SPRINT_1D_Bootstrap.md`

**Summary:** Implement the full bootstrap sequence from BLUEPRINT_FINAL.md §2.1. On every app open: load KERNL context, load dev protocol files from D:\Dev\, build a context injection package, inject it as the system prompt on the first API call. Cold start target: under 60 seconds.

**Key deliverable:** System prompt sent to Claude contains content from TECHNICAL_STANDARDS.md, last session summary, and recent decisions.

**New directory:** `app/lib/bootstrap/` with: `index.ts`, `context-builder.ts`, `dev-protocols.ts`, `aegis-signal.ts` (stub — logs only), `types.ts`

**Dev protocol loading:** Use Node.js `fs.readFile` with absolute paths. Never block bootstrap on missing files — log warning and continue with null. Store load errors in context package for visibility.

**System prompt assembly:** Base identity + dev protocols + last session summary + recent decisions + active projects. Full format in sprint blueprint.

**Cold start timing:** `console.time('bootstrap')` / `console.timeEnd('bootstrap')` — capture and log. Must be under 60,000ms.

**Update chat route:** Replace static system prompt with context package system prompt. Cache context package at module level, refresh every 30 minutes.

**Commit gate:** `sprint-1d: bootstrap sequence, context injection`

---

### SPRINT 1E — Phase 1 Completion Gate

**Read first:** `D:\Projects\GregLite\SPRINT_1E_Phase1Gate.md`

**Summary:** Integration, hardening, and verification. Wire everything together. Run every gate check. Phase 1 is not done until all gates pass.

**Key deliverable:** Conversation survives app restart with full context restored.

**Tasks:**
1. Fix Header branding — `app/components/ui/Header.tsx` — change "GREGORE" to "Gregore Lite"
2. Grep audit — zero results for: `OrchestrationExecutor`, `ghostApproved`, `override-policies`, `from '@/lib/aot'`, `from '@/lib/orchestration'`, `from '@/lib/world'`
3. Manual restart test — send 5 messages, kill app, restart, verify all 5 visible
4. System prompt verification — DevTools Network tab, confirm dev protocol content in system prompt
5. Cold start timing — confirm under 60s in console
6. Clean up `app/lib/types/index.ts` and `app/lib/services/index.ts` of deleted exports
7. Update STATUS.md — mark Phase 1 complete, record cold start measurement

**All gates must pass before commit:**
- `npx tsc --noEmit` — zero errors
- `pnpm test:run` — zero failures
- Conversation survives restart (manual test)
- System prompt contains dev protocol content
- Header shows "Gregore Lite"
- Zero Gregore orchestration imports in active code

**Commit gate:** `phase-1: complete — working strategic thread, KERNL persistence, crash recovery, bootstrap sequence`

---

## SESSION END PROTOCOL

When all five sprints are complete and all gates pass:

1. Final `npx tsc --noEmit` — must be zero errors
2. Final `pnpm test:run` — must be zero failures  
3. Update `D:\Projects\GregLite\STATUS.md`:
   - Mark all Phase 1 sprints complete with checkboxes
   - Set phase to "Phase 2 — Parallel (ready to queue)"
   - Record actual cold start measurement
   - Record date completed
4. Git add, commit, push:
   ```
   git add -A
   git commit -m "phase-1: complete — working strategic thread, KERNL persistence, crash recovery, bootstrap sequence"
   git push
   ```
5. Write a MORNING_BRIEFING.md to `D:\Projects\GregLite\` with:
   - What was completed
   - Any decisions made (with rationale)
   - Any deviations from sprint blueprints (with reason)
   - Anything blocked or deferred
   - Measured cold start time
   - Next action: queue Phase 2 parallel sprints

---

## ENVIRONMENT NOTES

- OS: Windows 11
- Shell: PowerShell
- Project root: `D:\Projects\GregLite\`
- App directory: `D:\Projects\GregLite\app\`
- Package manager: pnpm
- Node version: check with `node --version` on first run
- API key: already in `app\.env.local` as `ANTHROPIC_API_KEY`
- Git: already initialized, safe.directory configured
- Dev server: `pnpm dev` from `app\` directory → localhost:3000

**DO NOT:**
- Modify anything in `D:\Projects\Gregore\` — that is the source project, not GregLite
- Commit `.env.local` — it contains live API keys
- Remove or modify `BLUEPRINT_FINAL.md`, `STATUS.md`, or any sprint blueprint files
- Add `node_modules` to git
- Use `console.log` in production code — use `winston` logger

---

## IF YOU GET STUCK

If a sprint blueprint is ambiguous on implementation detail, check BLUEPRINT_FINAL.md for the relevant section first. The blueprints reference specific §sections. If still unclear after reading the spec, write a BLOCKED report and stop — do not improvise architecture.

If a TypeScript error is introduced and cannot be resolved cleanly in 2 attempts, stop and report. Do not accumulate type errors.

If a test fails and the fix is not obvious from the test output, stop and report. Do not delete tests to make the suite pass.

---

*This brief is the complete execution contract for Phase 1. Nothing outside this document and the referenced sprint blueprints should be implemented in this session.*
