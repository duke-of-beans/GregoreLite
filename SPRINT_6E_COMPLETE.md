# SPRINT 6E COMPLETE — Ghost Interrupt Scoring Engine

**Date:** March 2, 2026  
**Tests:** 677/677 passing (37 new)  
**TSC:** 0 errors  
**Commit:** sprint-6e: Ghost interrupt scoring engine, 6h cadence, 24h cap

---

## What Was Built

The Ghost interrupt scoring engine — the component that decides *when* to surface a Ghost suggestion and *which* one to show. It runs on a 6-hour setInterval, pulls candidates from the vector store, scores them using the BLUEPRINT §6.4 formula, checks the 24-hour rolling window cap, generates a Haiku summary, and deposits the result into the in-memory `_activeSuggestions` Map for the context panel to consume.

---

## Files Created

### Schema (`app/lib/kernl/schema.sql`)
Three additions:
- `ALTER TABLE ghost_indexed_items ADD COLUMN IF NOT EXISTS critical INTEGER DEFAULT 0` — importance flag for critical chunks (boosts score by 1.5×)
- `ghost_suggestion_feedback (id, chunk_id, source_path, action CHECK('dismissed'|'noted'|'expanded'), logged_at)` — tracks user interaction with suggestions
- `ghost_surfaced (id, chunk_id, score, surfaced_at, expires_at, dismissed_at)` — the 24h rolling window state

### `app/lib/ghost/scorer/types.ts`
Core interfaces: `GhostCandidate`, `GhostSuggestion`, `ScorerConfig`. The `DEFAULT_SCORER_CONFIG` sets minSimilarity=0.75, candidateK=50, intervalMs=6h, maxPerWindow=2, windowMs=24h, suggestionTtlMs=4h.

### `app/lib/ghost/scorer/context.ts`
`buildActiveContextVector()` — assembles the active working context from the last 5 assistant messages in the most recent thread, plus any running manifest title/description, plus the current project name. Embeds the concatenated text via dynamic import of `embedText()` (breaking a potential circular import). Returns `null` when GregLite is idle (no messages) — scorer skips the run.

`buildContextSummary()` — synchronous plain-text version (≤200 chars) of the same context signal, used in Haiku prompts.

### `app/lib/ghost/scorer/candidates.ts`
`generateCandidates(contextVector, k=50, minSimilarity=0.75)` — calls `searchSimilar()` directly with the pre-built Float32Array (bypasses `findSimilarChunks` which embeds text). Filters to only Ghost-sourced chunks (`metadata.source === 'ghost'`). Queries `ghost_indexed_items.critical` for the importance flag.

### `app/lib/ghost/scorer/scorer.ts`
Pure, synchronous scoring functions using better-sqlite3 directly:

- `computeRecencyBoost(indexedAt, now)` — 1.0 within 7 days, linear decay to 0.5 at 90 days, flat 0.5 beyond
- `computeRelevanceBoost(sourcePath)` — 1.2 if the source path is under any active project's root (normalises Windows backslashes for comparison), 1.0 otherwise
- `computeDismissalPenalty(sourcePath)` — 0.2 × count of dismissals in last 30 days for this source path, capped at 0.8
- `scoreCandidate(candidate, now)` — full BLUEPRINT §6.4 formula: `similarity × recencyBoost × relevanceBoost × (1 - dismissalPenalty) × importanceBoost`

### `app/lib/ghost/scorer/window.ts`
- `canSurface(maxPerWindow, windowMs)` — counts ALL surfaced rows in the window (including dismissed) against the cap. Dismissed suggestions still count against the daily budget.
- `recordSurfaced(suggestion)` — INSERT to ghost_surfaced
- `dismissSurfaced(id)` — UPDATE dismissed_at
- `criticalOverride(similarity, importanceBoost)` — returns `true` only when similarity > 0.95 AND importanceBoost > 1.3. Bypasses the 24h cap entirely.

### `app/lib/ghost/scorer/index.ts`
Public API:
- `runScorer()` — full scoring pass: AEGIS check → context vector (null = skip) → generate candidates → score + sort → window check (with critical override) → Haiku summary → deposit in `_activeSuggestions` Map
- `getActiveSuggestions()` — lazily prunes expired suggestions from the Map, returns remaining sorted desc by score
- `dismissSuggestion(id)` — removes from Map, calls `dismissSurfaced()`, writes `ghost_suggestion_feedback` 'dismissed' row
- `recordFeedback(id, action)` — 'noted' | 'expanded' without dismissing
- `startScorerSchedule()` / `stopScorerSchedule()` — setInterval wrapper firing every 6h, fires once immediately on start

### `app/lib/ghost/__tests__/scorer.test.ts`
37 tests covering all scorer modules:
- `computeRecencyBoost` — 6 tests (boundary at 7d, 90d, midpoint, strictly decreasing)
- `computeRelevanceBoost` — 4 tests (null path, no match, match, Windows backslash normalisation)
- `computeDismissalPenalty` — 5 tests (null path, 0/1/2 dismissals, cap at 0.8)
- `scoreCandidate` — 6 tests (baseline, importance boost, recency decay, relevance boost, dismissal penalty, full formula)
- `criticalOverride` — 3 tests (similarity boundary, importanceBoost boundary, both required)
- `canSurface` — 5 tests (0/1/2 surfaced, cap exceeded, custom maxPerWindow)
- `recordSurfaced` — 1 test (INSERT column verification)
- `buildActiveContextVector` — 3 tests (null when idle, null when no assistant messages, Float32Array when active)
- `getActiveSuggestions` — 1 test (empty when nothing surfaced)
- `runScorer` — 2 tests (no-op when AEGIS paused, no-op when context null)
- `dismissSuggestion` — 1 test (no-op when id not in Map)

---

## Key Technical Decisions

**BLUEPRINT §6.4 formula**: `similarity × recency_boost × relevance_boost × (1 - dismissal_penalty) × importance_boost`. All multiplied — a score of 0 in any dimension kills the suggestion.

**Recency decay curve**: Linear from 1.0 at ≤7 days to 0.5 at 90 days. Flat 0.5 beyond. This keeps older content surfaceable but deprioritised — a 6-month-old design note still has value.

**24h rolling window vs. 24h reset**: The window counts everything surfaced in the last 24 hours, not since midnight. A suggestion at 11pm and another at 1am the next day are only 2 hours apart — both count. This prevents gaming the reset.

**Critical override threshold**: similarity > 0.95 AND importanceBoost > 1.3 (not OR). Both conditions must be met simultaneously. This keeps the override rare and meaningful — a critical chunk with only moderate similarity doesn't qualify.

**Dismissed suggestions count against the window**: A user dismissing two suggestions doesn't get two more. The 2-per-24h budget is for surfacing events, not accepted events. This prevents spam recovery patterns.

**Haiku [UNTRUSTED CONTENT] enforcement**: The system prompt explicitly labels all chunk content as untrusted before sending to Haiku. Haiku generates the summary description — the actual chunk text is never shown directly to the user.

**Dynamic import for embedText**: `context.ts` uses `await import('@/lib/embeddings/model')` inside the function body to avoid a circular dependency chain (scorer → embeddings → vector → scorer). Vitest intercepts dynamic imports with the same `vi.mock()` — no special treatment needed.

---

## Test Infrastructure Discoveries

**Vitest v4 `function` vs arrow in constructor mocks**: `vi.fn().mockImplementation(() => ({...}))` cannot be called with `new` — arrow functions are not constructors. Vitest emits a warning: "did not use 'function' or 'class'". Fix: `vi.fn().mockImplementation(function() { return {...}; })`.

**mockReturnValueOnce queue bleed**: Queued once-values persist across test boundaries. A test that returns early without consuming all its queued values leaves poison for the next test. Fix: `beforeEach(() => { mockGet.mockReset(); mockAll.mockReset(); ... })` targeted only at the DB mocks.

**vi.resetAllMocks() too broad**: This wipes all mock implementations globally — `getDatabase()` returns `undefined`, `getLatestAegisSignal()` returns `undefined`. Cascade failures across every test that calls either. Use per-mock `.mockReset()` instead.

---

## Next: Sprint 6F — Ghost Process Lifecycle + IPC

- Startup order (KERNL ready → watcher start → email poller start → scorer start)
- Graceful shutdown (drain queues, flush, stop all timers)
- Degraded component detection (watcher fail → log + continue, email fail → Decision Gate)
- AEGIS propagation (all three subsystems pause/resume together)
- IPC message contracts (Tauri ↔ Next.js for status queries)
