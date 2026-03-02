# Sprint 7C Complete — Error Handling + Restart

**Date:** March 2, 2026
**Tests:** 799/799 passing (37 files, +38 new tests)
**TSC:** 0 errors

---

## What Was Built

Sprint 7C adds the full error handling and restart layer to the Phase 7 Agent SDK. Every failure mode has a detection path, a clean terminal state, and a handoff report that lets a restarted session avoid duplicating work already done.

---

## Failure Modes Implemented

**CONTEXT_LIMIT** — SDK stop_reason === 'max_tokens'. Emits `error_terminal` → status `failed`. No retry. Message: "Context limit reached. Consider splitting into smaller tasks." David sees this immediately and can restart with a smaller manifest.

**TOOL_ERROR** — Any non-network SDK exception during a stream round-trip. Auto-retries up to 3 times with exponential backoff: 1s → 2s → 4s. After 3 failures: `failed`. Handled by the `sdkRetryLoop` inside `query.ts`.

**NETWORK_ERROR** — ECONNRESET, ETIMEDOUT, socket hang up, or similar connection-layer errors. 1 auto-retry after 2 seconds. Then `failed`. Same `sdkRetryLoop`.

**IMPOSSIBLE_TASK** — Claude's `end_turn` response contains an explicit impossibility phrase ("cannot", "impossible", "not possible", "unable to") AND no files were written during the session. The no-files guard prevents false positives when Claude includes a cautionary disclaimer after completing partial work. Status `failed`, no retry.

**APP_CRASH** — Any session in running/working/validating state on app restart → `interrupted`. Implemented in Phase 7A via `markInterruptedOnBoot()`. No change needed in 7C; stub verified.

**SHIM_LOOP** — 3 consecutive SHIM calls on same file with no quality score improvement → `blocked` + escalation banner. Detection predicate stubbed (`detectShimLoop()` returns false). Full implementation in Phase 7G.

---

## Kill Switch ⊥ Backoff Mutual Exclusion

The kill switch (`killSession()` → `AbortController.abort()`) and backoff sleep delays are guaranteed mutually exclusive by `sleepMs()` in `query.ts`. When `abort()` fires during a backoff sleep, the sleep Promise rejects immediately via the `abort` event listener. The rejection propagates out of `sdkRetryLoop` to `break outerLoop`, transitioning the session to `interrupted`. There is no state where the session is simultaneously aborting and retrying.

---

## Handoff Report Format

Template (per §4.3.4):
```
PRIOR EXECUTION CONTEXT:
- This task was previously attempted. It did not complete.
- The following files were written and exist on disk: {files_written}
- The session was stopped because: {failure_reason}
- Steps completed before failure: {steps_completed}
- Last successful tool call: {last_tool_call}
- Please inspect existing files before proceeding. Do not duplicate work already done.
```

Measured max length with realistic job_state data: ~400 chars. Well under the 2000-char safety threshold validated in the prompt-length test.

---

## Session Restart Round-Trip

`spawnRestart(originalManifestId)` executes in 6 steps:
1. Load original manifest row from `manifests` table
2. Build handoff report from `job_state` row
3. Clone manifest with new `randomUUID()` manifest_id
4. Prepend handoff report to task description
5. INSERT new manifest row; INSERT `session_restarts` audit row
6. Call `spawnSession()` from Phase 7A

The `session_restarts` table records every restart for audit — `original_manifest_id`, `new_manifest_id`, `restart_reason` (extracted from `job_state.last_event`), `restarted_at`, and `restarted_by` ('user' or 'auto' for future auto-restart).

---

## Files Created / Modified

| File | Change |
|------|--------|
| `app/lib/kernl/schema.sql` | Added `session_restarts` table + index |
| `app/lib/agent-sdk/failure-modes.ts` | NEW — FailureMode enum + 5 detection predicates |
| `app/lib/agent-sdk/handoff-report.ts` | NEW — buildHandoffReport() |
| `app/lib/agent-sdk/error-handler.ts` | NEW — withBackoff, classifyStopReason, classifyError |
| `app/lib/agent-sdk/restart.ts` | NEW — spawnRestart() |
| `app/lib/agent-sdk/query.ts` | MODIFIED — sdkRetryLoop, failure mode routing, max_tokens, end_turn |
| `app/lib/agent-sdk/__tests__/error-handling.test.ts` | NEW — 38 tests across 8 describe blocks |

---

## Architecture Decisions

**Labeled loops over helper functions** — The SDK retry logic uses `outerLoop:` and `sdkRetryLoop:` labels in query.ts rather than extracting each round into a helper function. This keeps all session state (`stepsCompleted`, `filesModified`, `tokensUsedSoFar`, etc.) in the outer scope without threading it through function parameters. The labeled break/continue pattern is idiomatic TypeScript and avoids closure overhead.

**baseDelayMs=0 in tests** — `withBackoff(fn, 3, 0)` exercises all retry logic without fake timers or unhandled rejection warnings. `0 * 2^attempt = 0ms` means no actual sleep, making the tests deterministic and fast.

**`detectShimLoop` stub** — Returns false unconditionally. The SHIM_LOOP failure mode is correctly defined and wired (would emit BLOCKED state) but the detection predicate is a stub until Phase 7G provides the SHIM call history tracking it needs to examine.

---

## Next Sprint

7D — Cost accounting: token capture from SDK usage events, `session_costs` table, `pricing.yaml`, live cost ticker in job queue UI, daily budget caps with hard stop.
