# SPRINT 3E COMPLETE — Suggestion Feedback, Threshold Calibration, Proactive Surfacing

**Completed:** March 1, 2026  
**Tests:** 328/328 passing (34 new)  
**TSC:** 0 errors  
**Commit:** `626aab3` — `sprint-3e: suggestion feedback, threshold calibration, proactive surfacing`

---

## What Was Built

Sprint 3E implements the full cross-context intelligence feedback loop: surfacing ranked suggestions to the user, recording their actions (accept/dismiss/ignore), calibrating similarity thresholds based on usage patterns, and suppressing persistently-rejected suggestions.

---

## New Files

### `app/lib/cross-context/types.ts`
Core type definitions for the cross-context engine. `FeedbackAction` (`accepted | dismissed | ignored`), `SurfaceContext` (`on_input | pattern | already_built`), `ThresholdConfig` (three named thresholds), `Suggestion` (the full surfaced suggestion object), `CalibrationResult`, and `SuggestionRow` (raw DB row shape).

### `app/lib/cross-context/thresholds.ts`
Threshold persistence and drift adjustment. Three default thresholds (`patternDetection: 0.75`, `onInputSuggestion: 0.85`, `alreadyBuiltGate: 0.72`) are stored in the `settings` table as JSON under key `threshold_config`. `adjustThreshold(value, direction)` applies ±0.01 per event, `clamp()` enforces [0.65, 0.92] hard bounds. All saves are clamped before write.

### `app/lib/cross-context/calibrator.ts`
Threshold drift calibration. `runCalibration()` loads the last 500 feedback events since the previous calibration run. For `on_input` and `pattern` contexts (≥10 samples each), it computes the accept rate and applies `adjustThreshold` up if accept rate ≥ 80%, down if ≤ 30%. For the `already_built` gate, it runs a GROUP BY query to detect chunks with ≥3 dismissals and no accepts since last calibration — each such chunk triggers +0.03 drift on `alreadyBuiltGate`. Last calibration timestamp is persisted in `settings` under `last_calibration_at`.

### `app/lib/cross-context/feedback.ts`
User action recording. `insertSuggestion()` inserts a new suggestion row (returns nanoid). `recordFeedback()` updates `user_action` and `acted_at` for a suggestion by ID, then checks whether to trigger calibration: fires if ≥100 events since last calibration OR if ≥24 hours have elapsed.

### `app/lib/cross-context/surfacing.ts`
Ranking, filtering, and suppression. `getRecencyFactor(createdAt)` returns 1.0 for content ≤7 days old, linear decay to 0.5 at 90 days, clamped at 0.5 beyond. `getDismissalPenalty(chunkId)` applies 0.2 per dismissal in last 30 days, capped at 0.8. `isSuppressed(chunkId)` returns true if ≥5 dismissals in 7 days OR ≥3 dismissals in 48 hours. `rankAndFilter(candidates, threshold)` applies the full display score formula (`similarity² × recencyFactor × (1 - dismissalPenalty)`), filters by threshold, sorts descending, returns max 2.

---

## Schema Changes

### `app/lib/kernl/schema.sql` and `app/lib/kernl/database.ts` (INLINE_SCHEMA)
Two new tables added:

**`suggestions`** — records every suggestion surfaced to the user: similarity score, computed display score, surface context, user action, timestamps. Indexed on `(chunk_id, acted_at DESC)` and `(surface_context, acted_at DESC)`.

**`settings`** — key/value store for persistent engine configuration (threshold config, last calibration timestamp). Simple upsert pattern on `key`.

---

## Tests

**`app/lib/__tests__/unit/cross-context.test.ts`** — 34 tests across all 5 modules:
- `clamp` — 3 tests (below min, above max, within range)
- `loadThresholds` — 4 tests (defaults when empty, persisted values, partial override, clamp on load)
- `saveThresholds` — 2 tests (upsert called, clamping enforced before save)
- `adjustThreshold` — 2 tests (positive drift, negative drift)
- `recordFeedback` — 4 tests (UPDATE called, calibration trigger on 100 events, calibration trigger on 24h elapsed, no trigger below threshold)
- `insertSuggestion` — 1 test (INSERT called, nanoid returned)
- `getRecencyFactor` — 5 tests (≤7d = 1.0, >90d = 0.5, linear midpoint, exactly 7d, exactly 90d)
- `getDismissalPenalty` — 3 tests (no dismissals, 2 dismissals, cap at 0.8)
- `isSuppressed` — 4 tests (7d window ≥5, 48h window ≥3, 7d window below threshold, 48h below threshold)
- `rankAndFilter` — 6 tests (suppressed filtered, below threshold filtered, ranking formula correct, max 2 returned, empty input, all pass)

---

## Key Decisions

**Consecutive dismissal detection without window functions** — SQLite window function support was uncertain across all target platforms. Used GROUP BY + subquery excluding accepts since last calibration instead: `SELECT chunk_id FROM suggestions WHERE user_action='dismissed' AND acted_at > ? AND chunk_id NOT IN (SELECT chunk_id ... WHERE user_action='accepted' AND acted_at > ?) GROUP BY chunk_id HAVING COUNT(*) >= 3`. Equivalent semantics, portable SQL.

**Display score formula** — `similarity² × recencyFactor × (1 - dismissalPenalty)`. Squaring similarity sharpens the relevance curve so near-threshold matches drop off steeply. Recency and dismissal factors are multiplicative modifiers, not additive, keeping the score bounded to [0, 1].

**Max 2 suggestions** — Cognitive load constraint. More than 2 simultaneous suggestions trains users to ignore the panel. The top 2 by display score are surfaced; the rest are ranked but held in reserve.

**Calibration trigger duality** — Either 100 feedback events OR 24 hours elapsed since last calibration triggers a run. Event-based keeps the system responsive during heavy use; time-based ensures calibration runs even during light use periods.

---

## Sprint 3E Gate Results

| Gate | Result |
|------|--------|
| tsc --noEmit | ✅ 0 errors |
| pnpm test:run (full suite) | ✅ 328/328 passing (34 new) |
| suggestions + settings tables | ✅ schema.sql + INLINE_SCHEMA |
| types.ts | ✅ FeedbackAction, SurfaceContext, ThresholdConfig, Suggestion |
| thresholds.ts | ✅ clamp [0.65,0.92], load/save/adjust |
| calibrator.ts | ✅ runCalibration, consecutive dismissal +0.03, 24h/100-event triggers |
| feedback.ts | ✅ recordFeedback, insertSuggestion |
| surfacing.ts | ✅ rankAndFilter, isSuppressed, getRecencyFactor, getDismissalPenalty |
| cross-context.test.ts | ✅ 34 tests |
| STATUS.md updated | ✅ Done |
| Conventional commit + push | ✅ 626aab3 |
