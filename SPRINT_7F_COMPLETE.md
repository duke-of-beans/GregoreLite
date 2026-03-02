# Sprint 7F Complete — Job Queue UI

**Date:** March 2, 2026
**Baseline:** Sprint 7E commit e9ae7a6
**Branch:** main

## Summary

Sprint 7F builds the control surface for everything Phases 7A–7E constructed. David can now see every session's state, cost, and live output in real time, restart interrupted sessions with handoff context, and manage budget caps from a settings panel accessible from the queue header.

## New Files

### API Routes (`app/app/api/agent-sdk/`)

| File | Purpose |
|------|---------|
| `jobs/route.ts` | GET all sessions: DB manifests + in-memory pending queue |
| `jobs/[id]/route.ts` | GET single session detail (manifest + job_state merged) |
| `jobs/[id]/output/route.ts` | GET last 500 lines from ring buffer or temp log file |
| `jobs/[id]/kill/route.ts` | POST kill: aborts SDK stream, releases scheduler slot |
| `jobs/[id]/restart/route.ts` | POST restart: delegates to spawnRestart() from 7C |
| `budget/route.ts` | GET config + daily total; PATCH to save budget_config values |

### React Components (`app/components/agent-sdk/`)

| File | Purpose |
|------|---------|
| `types.ts` | Shared `AgentJobView` interface + status set constants |
| `JobStatusBadge.tsx` | Status → color + label; 9 states with correct spec colors |
| `JobCard.tsx` | Active/completed card: metrics, cap bar, kill confirmation, [Merge PR] stub |
| `JobQueue.tsx` | Container: 2s polling, sections (ACTIVE/QUEUED/INTERRUPTED/RECENT), daily burn badge, budget settings flyout |
| `LiveOutputPanel.tsx` | Opt-in output viewer: 2s polling, scroll-lock auto-scroll, ring buffer or log file |
| `InterruptedSessionCard.tsx` | INTERRUPTED state: failure reason, files written, [Restart with Handoff] + [Dismiss] |
| `PendingSessionCard.tsx` | PENDING state: queue position badge, estimated wait, [Cancel] |
| `BudgetSettingsPanel.tsx` | Three-field form: session soft cap, daily hard cap, rate limit — saves to budget_config |
| `index.ts` | Barrel re-export of all components + AgentJobView type |

## Modified Files

| File | Change |
|------|--------|
| `app/lib/agent-sdk/session-logger.ts` | Added module-level logger registry: `registerLogger`, `getLogger`, `deregisterLogger` |
| `app/lib/agent-sdk/query.ts` | `registerLogger()` on creation; `deregisterLogger()` before each of 5 `logger.close()` call sites |
| `app/lib/agent-sdk/scheduler.ts` | Added `getPendingManifests()` — returns `{entry, manifest}[]` for the list API |
| `app/lib/agent-sdk/index.ts` | Exported `getPendingManifests()` wrapping scheduler |

## Architecture Decisions

**SessionLogger registry:** The live output problem is that `SessionLogger` was a local variable inside `runQuerySession()`. Sprint 7F adds a module-level `Map<string, SessionLogger>` in `session-logger.ts`. `query.ts` registers on creation and deregisters before each close call. This is a clean zero-debt solution — the registry stays in the same module that owns the loggers, and the API route just calls `getLogger(id)`.

**Pending sessions + DB sessions in the list API:** Sessions in the scheduler's in-memory queue haven't called `runQuerySession()` yet, so they have no manifest DB row. The list endpoint combines `listManifestRows()` (DB) with `getPendingManifests()` (in-memory) and deduplicates by manifestId. This gives a complete view including sessions waiting for a slot.

**2-second polling (no websockets):** Per brief — intentional simplicity. The polling interval is fast enough for the use case and keeps the architecture flat. If latency becomes noticeable with >8 concurrent sessions, SSE is the natural upgrade path (no state machine changes needed, just change the transport).

**Kill confirmation pattern:** Inline two-step (Kill button → [Kill? Confirm] [× Cancel]) rather than a modal, to stay consistent with the existing GregLite dense UI style and avoid breaking the narrow 25% panel layout.

**[Merge PR] button:** Visible for `completed` + `is_self_evolution` sessions. Renders as a disabled placeholder with `cursor: not-allowed` and 50% opacity. Full GitHub API integration is Sprint 7H. The button location and data dependencies are correct; only the click handler is stubbed.

**Budget flyout:** Clicking the daily burn badge in the queue header opens `BudgetSettingsPanel` as an absolutely-positioned overlay. This follows the existing GregLite pattern (BudgetCapAlert is already a floating component).

## Quality Gates

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | ✅ Zero errors |
| `npx vitest run` | ✅ 863/863 tests passing (39 files) |
| Status badge colors match spec | ✅ All 9 states verified against brief |
| Live output ring buffer access | ✅ Registry wired, 5 close() sites patched |
| Kill confirmation dialog | ✅ Two-step inline, files-preserved note |
| Restart with Handoff | ✅ Calls spawnRestart(), new session visible on next poll |
| [Merge PR] placeholder | ✅ self_evolution + completed only, stub only |
| Pending sessions in queue | ✅ Combined DB + in-memory view |
| Budget settings save | ✅ PATCH /api/agent-sdk/budget → setBudgetConfig() |

## Polling Performance Note

With 8 concurrent sessions, each 2s poll triggers 1 SELECT on manifests + 8 SELECT on job_state. At SQLite WAL mode read concurrency this is negligible (<5ms). If sessions scale beyond 8 in future, consider a single JOIN query replacing the per-session job_state lookups.

## Next Sprint

Sprint 7G: SHIM Hybrid Integration — in-session SHIM tool stub, post-processing quality gate, 3× retry ceiling, SHIM_LOOP escalation to Opus.
