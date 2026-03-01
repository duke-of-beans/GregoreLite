# SPRINT 3F COMPLETE — "You Already Built This" Gate

**Completed:** March 1, 2026  
**Tests:** 340/340 passing (12 new)  
**TSC:** 0 errors  
**Commit:** `c84582e` — `sprint-3f: already-built gate, interception modal, context library`

---

## What Was Built

Sprint 3F implements the manifest interception gate — the highest-value Cross-Context feature. Before David spawns an Agent SDK worker session, GregLite embeds the manifest title + description, searches the vector index, and intercepts if similar past work is found. Three choices: view the diff, reuse as base context, or override and proceed. Repeated overrides auto-adapt the threshold.

---

## New Files

### `app/lib/cross-context/gate.ts`
Pre-manifest check. `checkBeforeManifest(manifest)` builds query text from `manifest.task.title + description`, reads `alreadyBuiltGate` from persisted thresholds, calls `findSimilarChunks()`, and returns `{ shouldIntercept: boolean, matches: GateMatch[] }`. Async — the vec search path involves dynamic embed import.

### `app/lib/cross-context/override-tracker.ts`
Tracks per-chunk override counts in the `settings` table under keys `gate_override_<chunkId>`. `recordOverride(chunkId)` increments the counter; on reaching 3, calls `adjustThreshold('alreadyBuiltGate', +0.05)` and resets the counter. `getOverrideCount(chunkId)` reads the current count (0 if absent). The threshold self-adapts: if David overrides the same pattern 3 times, the gate simply raises the bar.

### `app/lib/cross-context/index.ts`
Barrel export for all cross-context modules (Sprint 3E + 3F). Single import point for consumers.

### `app/app/api/cross-context/suppressed/route.ts`
`GET` — returns suppressed suggestions (user_action = 'dismissed') joined with `content_chunks` for content preview, source type/id, and similarity score. `DELETE ?id=` — clears user_action and acted_at to return a suggestion to the active pool.

### `app/components/cross-context/SimilarityDiff.tsx`
Monaco `DiffEditor` with `{ ssr: false }` dynamic import. Shows existing matched content on the left, proposed manifest description on the right. Read-only, word-wrap on, minimap off. The `ssr: false` guard is the same pattern used in Sprint 2D for the code artifact view.

### `app/components/cross-context/AlreadyBuiltModal.tsx`
Full interception modal. Shows similarity score, match preview (first 400 chars), and source thread ID. If multiple matches were found, a row of score buttons lets David switch between them. Three action buttons: "View Code" toggles the Monaco diff inline, "Reuse as Base" fires `onReuseAsBase(content)` which pre-fills the manifest description, "Continue Anyway" fires `onContinue(chunkId)` which calls `recordOverride()` and proceeds. Clicking outside the modal closes it.

### `app/components/cross-context/ContextLibrary.tsx`
Right-side drawer showing all suppressed suggestions. Fetches from `/api/cross-context/suppressed` on open. Each item shows a content preview, source metadata, similarity score, and surface context badge. "Un-suppress" button calls DELETE and removes the item from the list immediately (optimistic removal). Backdrop click closes the drawer.

### `app/components/cross-context/index.ts`
Component barrel export.

---

## Modified Files

### `app/components/jobs/ManifestBuilder.tsx`
Gate intercept point added in `handleSubmit()`. After building the manifest but before calling `spawnJob()`, calls `checkBeforeManifest()`. If `shouldIntercept`, sets `gateMatches` state and returns early — the modal renders. `doSpawn()` extracted as a shared helper called by both the happy path and the "Continue Anyway" handler. `handleReuseAsBase(content)` pre-fills the description textarea. `handleCloseGate()` dismisses without spawning.

### `app/components/context/SuggestionSlot.tsx`
Replaced the stub with a live component. Now renders the pending suggestion count plus a "LIBRARY" button that opens the `ContextLibrary` drawer.

### `app/lib/__tests__/unit/cross-context.test.ts`
Fixed flaky boundary test: "returns 1.0 for content created 7 days ago" was using `Date.now() - 7*24*60*60*1000` exactly, which causes sub-millisecond drift depending on test execution timing. Changed to `justUnder7Days = Date.now() - (7 * 24 * 60 * 60 * 1000 - 60_000)` to stay safely within the ≤7 day region.

---

## Tests

**`app/lib/__tests__/unit/gate.test.ts`** — 12 tests:
- `checkBeforeManifest` (5): shouldIntercept false on empty, true on matches, queryText construction, threshold from loadThresholds, GateMatch field mapping
- `getOverrideCount` (2): returns 0 when absent, parses integer from settings row
- `recordOverride` (5): upserts count=1 on first call, no adjustThreshold on 1st/2nd, calls adjustThreshold(+0.05) on 3rd, deletes settings row after threshold hit

---

## Key Implementation Decisions

**Gate intercept point in ManifestBuilder** — The brief specifies interception BEFORE calling `spawn()`. The intercept sits between `buildManifest()` (local, synchronous) and `spawnJob()` (API call). This means the manifest is fully formed but not yet submitted — allowing "Reuse as Base" to modify it before submission.

**Override counter in settings table** — No new table needed. The existing `settings` key-value store (Sprint 3E) handles per-chunk override counts under `gate_override_<chunkId>` keys. Counter resets after the threshold bump so the cycle can repeat if David continues overriding.

**Monaco SSR pattern** — `dynamic(() => import('@monaco-editor/react').then(m => m.DiffEditor), { ssr: false })` is the same guard used in Sprint 2D's CodeArtifact. No SSR crash risk.

**ContextLibrary as client-side fetch** — The drawer is a client component that fetches `/api/cross-context/suppressed` on open. This avoids threading database access through RSC props and keeps the component self-contained.

---

## Sprint 3F Gate Results

| Gate | Result |
|------|--------|
| tsc --noEmit | ✅ 0 errors |
| pnpm test:run (full suite) | ✅ 340/340 passing (12 new) |
| Gate fires before manifest submitted | ✅ intercept in handleSubmit, before spawnJob() |
| Modal shows similarity score + preview | ✅ AlreadyBuiltModal |
| "View Code" opens Monaco diff (no SSR crash) | ✅ ssr: false dynamic import |
| "Reuse as Base" pre-fills manifest builder | ✅ handleReuseAsBase sets description state |
| "Continue Anyway" logs override + increments | ✅ recordOverride() called |
| 3 overrides → alreadyBuiltGate +0.05 | ✅ override-tracker.ts |
| Context Library drawer opens from context panel | ✅ SuggestionSlot LIBRARY button |
| Suppressed suggestions visible in library | ✅ GET /api/cross-context/suppressed |
| Un-suppress restores to active pool | ✅ DELETE /api/cross-context/suppressed?id= |
| STATUS.md updated | ✅ Done |
| Conventional commit + push | ✅ c84582e |
