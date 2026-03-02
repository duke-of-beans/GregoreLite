# SPRINT 4A COMPLETE — Decision Gate Trigger Detection
**Date:** March 1, 2026  
**Baseline entering sprint:** 374/374 tests, 19 test files, tsc clean  
**Baseline exiting sprint:** 417/417 tests, 20 test files, tsc clean  
**New tests:** 43 (decision-gate.test.ts)  
**Commit:** `sprint-4a: decision gate trigger detection`

---

## What Was Built

Sprint 4A delivers the full trigger detection layer and `decision_lock` state machine for the Decision Gate (§8 blueprint). Eight OR-logic trigger conditions are implemented; five are live and three are stubs held for Sprint 4B's Haiku inference call.

### Module: `app/lib/decision-gate/`

Five files, one public API surface:

**`types.ts`** — All type primitives: `GateTrigger` union, `TriggerResult`, `DecisionLockState`, `GateMessage`.

**`lock.ts`** — Module-level singleton state machine. `acquireLock(trigger, reason)` activates the gate and preserves `dismissCount` across re-triggers. `releaseLock()` resets everything including `dismissCount` (David approved; gate is satisfied). `dismissLock()` increments count and stays locked at count ≥ 3 (mandatory, undismissable). `isMandatory()` exposes the mandatory threshold. `_resetLockState()` is a test helper only.

**`trigger-detector.ts`** — All 8 detector functions:

| Trigger | Status | Logic |
|---|---|---|
| `repeated_question` | ✅ Live | Unigram + bigram + trigram extraction (stop-word filtered) across last 10 user messages; fires if any phrase appears in 3+ distinct messages |
| `sacred_principle_risk` | ✅ Live | Exact phrase match against 18-item list (`'temporary fix'`, `'technical debt'`, `'quick fix'`, `'mvp of'`, `'just for now'`, etc.) in last 5 messages |
| `irreversible_action` | ✅ Live | 18 regex patterns against last assistant message only (`drop table`, `deploy to prod`, `push to main`, `force push`, `breaking change`, etc.) |
| `low_confidence` | ✅ Live | 20 uncertainty phrases; fires when last assistant message contains ≥ 2 matches |
| `contradicts_prior` | ✅ Live | Delegates to `contradiction.ts` — cosine similarity ≥ 0.80 against `source_type = 'decision'` chunks via Phase 3's `findSimilarChunks()` |
| `high_tradeoff_count` | 🔲 Stub | Always returns false; Sprint 4B activates via Haiku inference |
| `multi_project_touch` | 🔲 Stub | Always returns false; Sprint 4B activates via Haiku inference |
| `large_build_estimate` | 🔲 Stub | Always returns false; Sprint 4B activates via Haiku inference |

**`contradiction.ts`** — Reuses Phase 3's `findSimilarChunks()` with threshold 0.80, filtered to `sourceType === 'decision'`. Fails open (returns false) on any error — never blocks conversation if vec_index is unavailable.

**`index.ts`** — Public API. `analyze(messages: GateMessage[]): Promise<TriggerResult>`. Evaluation order: sync checks first (repeated_question → sacred_principle_risk → irreversible_action → low_confidence), then async (contradicts_prior), then the three stubs. The `triggered()` helper pattern passes concrete `GateTrigger` string literals to `acquireLock()` — avoids `GateTrigger | null` assignment error without non-null assertions.

### Store: `app/lib/stores/decision-gate-store.ts`

Zustand store (no persistence — gate state is session-only). `setTrigger(result)` and `clearTrigger()`. Sprint 4B reads this to render the UI panel.

### Chat Route: `app/app/api/chat/route.ts`

Fire-and-forget `analyze()` call added after `checkpoint()`, same pattern as existing embedding persistence. Maps `history` + the final assistant message into `GateMessage[]`, calls `analyze()`, and on a triggered result calls `useDecisionGateStore.getState().setTrigger(result)`. Failures are logged as warn and swallowed — never delays API response.

---

## Test Coverage (43 new tests)

| Describe block | Tests | Notes |
|---|---|---|
| `detectRepeatedQuestion` | 5 | Window=10, threshold=3, n-gram dedup per message |
| `detectSacredPrincipleRisk` | 7 | Phrase list, window=5, case-insensitive |
| `detectIrreversibleAction` | 7 | Regex set, last assistant message only |
| `detectLowConfidence` | 6 | 20-phrase set, ≥2 threshold |
| `Sprint 4B stubs — always false` | 3 | One per stub, documented as always-false |
| `lock state machine` | 8 | acquireLock, releaseLock, dismissLock, mandatory threshold |
| `analyze()` | 4 | Integration tests; `@/lib/vector` mocked to return `[]` |

---

## False Positive Notes

Manual calibration not run this sprint (reserved for Sprint 4C). Observable behavior from test construction:

**`repeated_question`** is sensitive to any shared n-gram across messages. Test data must use genuinely unique vocabulary per message when testing the negative case — even common words like "topic" will trigger the detector if they appear in 3+ messages. In practice, conversational threads about the same project will share terminology; the 3-of-10 threshold is the tuning lever. Sprint 4C will calibrate against real KERNL chat history.

**`sacred_principle_risk`** is an exact phrase list — no false positives possible unless someone literally types the phrases. The 18-item list is conservative; expansion should happen in 4C after observation.

**`irreversible_action`** is regex-only against the last assistant message. Claude rarely writes "DROP TABLE" casually; risk of false positives is low. Sprint 4C can prune any patterns that fire incorrectly in production use.

**`low_confidence`** at ≥2 uncertainty phrases may fire on genuinely speculative but safe Claude responses ("I think you might want to consider..."). Threshold is the tuning lever; 4C will observe real thresholds.

---

## Key Decisions

**`triggered()` helper pattern** — Instead of passing `result.trigger` (typed `GateTrigger | null`) to `acquireLock()` (which requires `GateTrigger`), the `analyze()` function calls `triggered(literal, reason)` which takes the concrete string literal directly. Zero non-null assertions, TypeScript satisfied, readable call sites.

**Fail-open on contradiction** — `detectContradiction` returns false on any error from `findSimilarChunks()`. The gate must never block conversation due to a vector index outage.

**Stubs as `async` functions** — All three stubs return `Promise<false>` not `false`, consistent with the live detectors they'll replace in Sprint 4B. No `analyze()` refactor needed when activating them.

**No persistence on gate store** — Decision gate state is intentionally session-only. A locked gate from a previous session should not block a fresh session; David can address the decision at any time.

---

## Sprint 4B Entry Criteria

- Read `PHASE4B_EXECUTION_BRIEF.md`
- Baseline: 417/417 tests, tsc clean
- Activate 3 stubs via Haiku inference call (~$0.0005/message)
- Wire UI panel (reads `useDecisionGateStore`)
- Enforce HTTP 423 on `POST /api/chat` while `decision_lock.locked === true`
- Sprint 4B is sequential after 4A — do not start without a clean 4A baseline
