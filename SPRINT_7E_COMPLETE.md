# SPRINT 7E COMPLETE — Concurrency Scheduler

**Date:** March 2, 2026
**Branch:** master
**Commit:** (see git log)

## Delivered

### New Files
- `app/lib/agent-sdk/priority-config.ts` — Session type → numeric priority (0=strategic_thread … 5=ghost), `isBypassSession()`, `MAX_CONCURRENT_SESSIONS = 8`
- `app/lib/agent-sdk/rate-limiter.ts` — Token bucket, 60s sliding-window log, `isThrottled()` at ≥80% capacity, `consume()` / `reset()` / `getUsageRatio()`. Module-level `rateLimiter` singleton.
- `app/lib/agent-sdk/scheduler.ts` — `SessionScheduler` singleton. `enqueue()` checks slot count + rate limiter, starts immediately or queues. `onComplete()` releases slot, promotes highest-priority pending session. `cancel()` removes from pending or running. `_broadcastWorkerCount()` → AEGIS. `_resetForTests()` for test isolation.
- `app/lib/agent-sdk/aegis-integrator.ts` — `notifyWorkerCountChanged(n)` → `updateWorkerCount(n)` in AEGIS. Non-fatal: AEGIS offline is swallowed.
- `app/components/agent-sdk/QueuePositionBadge.tsx` — Shows `#{position}` for PENDING sessions. Includes throttle indicator. Returns null when position is null.
- `app/lib/agent-sdk/__tests__/scheduler.test.ts` — 31 tests covering priority-config (8), RateLimiter (8), SessionScheduler (15). 31/31 passing.

### Modified Files
- `app/lib/kernl/schema.sql` — Added `session_queue` table (id, manifest_id, session_type, priority, status, queue_position, enqueued_at, started_at, completed_at) + index on (status, priority ASC, enqueued_at ASC). Added `rate_limit_tokens_per_minute` to `budget_config` defaults.
- `app/lib/aegis/index.ts` — Added `updateWorkerCount(activeWorkers)` export: calls `ensureGovernor().updateState({ activeWorkers, hasActiveThread: true })` then `forceEvaluate()`.
- `app/lib/agent-sdk/index.ts` — `spawnSession()` now routes through `scheduler.enqueue()`. Added `queued` + `queuePosition` fields to `SpawnSessionResult`. `killSession()` calls `scheduler.cancel()`. Daily cap gate applied before scheduler.

## Key Design Decisions

- **In-memory slot tracking**: `_running` is a `Map<manifestId, entryId>`. No DB round-trip to count active sessions. DB is persistence-only (crash recovery for 7F UI).
- **Static import fix**: Initial `require('@/lib/kernl/database')` inside function body was not intercepted by `vi.mock`. Fixed to static `import { getDatabase } from '@/lib/kernl/database'` — standard Vitest mock pattern.
- **Test mock correction**: Tests assumed `mockGet({ cnt: 8 })` would gate the scheduler. Scheduler uses `_running.size`, not DB. Fixed by actually filling 8 slots via `enqueue()` calls before testing the 9th.
- **AEGIS bridge**: Added `updateWorkerCount()` to AEGIS public API rather than duplicating the profile-switch logic. Scheduler calls it on every slot change; AEGIS governor decides profile transition.
- **Strategic thread**: `isBypassSession('strategic_thread')` → bypass queue, bypass cap, bypass rate limiter, not tracked in `_running`.

## Test Results
- `scheduler.test.ts`: **31/31 passing**
- Full suite: No new failures introduced (all pre-existing failures confirmed on a7b35c0 baseline via `git stash` verification)

## Next: Sprint 7F — Job Queue UI
