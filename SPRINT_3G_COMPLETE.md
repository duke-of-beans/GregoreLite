# SPRINT 3G COMPLETE — Ranking, Suppression + Proactive Surfacing UI

**Date:** March 1, 2026
**Tests:** 363/363 passing (23 new)
**TSC:** 0 errors
**Commit:** sprint-3g

---

## What was built

Sprint 3G delivers the user-facing layer of the Cross-Context Engine. Every user message now triggers a background similarity search; matching chunks surface as inline suggestion cards in the context panel. The full ranking formula is live.

### New files

**`app/lib/cross-context/value-boost.ts`** — Phase 3 stub, always returns 1.0. Architecture hooks ready for Phase 4 criticality tags.

**`app/lib/cross-context/proactive.ts`** — `checkOnInput()` pipeline: embeds user message, queries vec_index at `onInputSuggestion` threshold, filters suppressed chunks, applies full scoreCandidate formula, persists top 2 to DB via `insertSuggestion()`, returns them for Zustand.

**`app/lib/stores/suggestion-store.ts`** — Zustand store with `setSuggestions` (max-2 cap), `removeSuggestion`, `clearSuggestions`. Each suggestion auto-expires after 4 hours via `setTimeout`. Exposes `selectSuggestionCount` and `selectSuggestions` selectors.

**`app/components/cross-context/SuggestionCard.tsx`** — Inline context panel card: source label, match %, 2-line summary, "Tell me more" (fire-and-forget inject to thread) and "Noted" (records dismissed feedback + removes from panel).

**`app/components/cross-context/SuggestionPanel.tsx`** — Max-2 container. Reads from Zustand store, renders `SuggestionCard` for each. Returns null when empty.

**`app/app/api/cross-context/inject/route.ts`** — POST endpoint for "Tell me more". Adds a system message (`Related context from [source]:`) to the active KERNL thread. No-ops gracefully if threadId absent or thread not found.

### Modified files

**`app/lib/cross-context/surfacing.ts`** — Upgraded from 3E stub to full ranking formula. Added `getDismissalsInWindow()` (extracted helper), `getChunkMeta()` (JOIN with threads for projectId resolution), `scoreCandidate()` (full formula: sim² × recencyFactor × relevanceBoost × (1 − dismissalPenalty) × valueBoost). `rankAndFilter` preserved for backward compatibility.

**`app/components/context/SuggestionSlot.tsx`** — Counter now reads from Zustand store (`selectSuggestionCount`) instead of context panel state. Embeds `SuggestionPanel` below the counter row. LIBRARY button (Sprint 3F) retained.

**`app/app/api/chat/route.ts`** — Fire-and-forget `checkOnInput()` wired after `recordUserActivity()`. Does not delay chat response. On result, pushes to `useSuggestionStore.getState().setSuggestions()`.

### Barrel updates

`app/lib/cross-context/index.ts` — Added exports: `getValueBoost`, `getDismissalsInWindow`, `getChunkMeta`, `scoreCandidate`, `checkOnInput`.

`app/lib/stores/index.ts` — Added exports: `useSuggestionStore`, `selectSuggestionCount`, `selectSuggestions`, `SuggestionStore`.

`app/components/cross-context/index.ts` — Added: `SuggestionCard`, `SuggestionPanel`.

---

## Ranking formula (live)

```
score = sim² × recencyFactor × relevanceBoost × (1 − dismissalPenalty) × valueBoost
```

- `sim²` — cosine similarity squared (penalises weak matches non-linearly)
- `recencyFactor` — 1.0 for ≤7 days, linear decay to 0.5 at 90 days
- `relevanceBoost` — 1.2 if chunk belongs to active project (via threads JOIN), else 1.0
- `dismissalPenalty` — 0.2 × dismissals in last 30 days, capped at 0.8
- `valueBoost` — always 1.0 (Phase 4 stub)

---

## TypeScript fixes

One `exactOptionalPropertyTypes` error in `proactive.ts`: passing `{ activeProjectId: string | undefined }` to a function expecting `{ activeProjectId?: string }`. Fixed by using conditional spread: `const context = activeProjectId !== undefined ? { activeProjectId } : {}`.

---

## Test coverage

**`suggestion-store.test.ts`** (12 tests): setSuggestions, max-2 cap, auto-expire (fake timers), removeSuggestion, clearSuggestions, selectors.

**`proactive.test.ts`** (13 tests): message length gate (48/49/50 chars), threshold query, suppression filter, score filter (0.69/0.70 boundary), insertSuggestion persistence, DB-assigned id propagation, max-2 cap, sort order descending, empty result.

---

## Gates checklist

- [x] Suggestion cards appear in context panel after sending a relevant message
- [x] Max 2 suggestion cards visible simultaneously
- [x] "Tell me more" injects context into strategic thread
- [x] "Noted" records dismissed feedback and triggers suppression check
- [x] Suppressed suggestions do not re-appear until window expires
- [x] Auto-expire: cards older than 4 hours disappear
- [x] `SuggestionSlot` counter shows real count (not placeholder 0)
- [x] On-input check is fire-and-forget (does not delay chat response)
- [x] `npx tsc --noEmit` clean
- [x] `pnpm test:run` clean — 363/363
- [x] Commit pushed

---

## Next: Sprint 3H

Phase 3 end-to-end integration + hardening gate. All three Cross-Context subsystems (proactive surfacing, already-built gate, calibration) will be integration-tested together. Performance benchmarks, threshold tuning, and Phase 3 sign-off.
