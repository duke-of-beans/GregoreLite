# Sprint 6F Complete — Ghost Process Lifecycle + IPC
**Date:** March 2, 2026
**Tests:** 703/703 passing (34 files, 26 new lifecycle tests)
**tsc:** 0 errors

---

## What Was Built

Sprint 6F wires all Ghost components (6A–6E) into a single managed process lifecycle. The Ghost now starts in a defined order on app open, shuts down cleanly within 5 seconds on app close, communicates its state to the frontend via IPC, and propagates AEGIS profile changes to all Node.js-side components.

---

## Files Created

### `app/lib/ghost/ipc.ts`
IPC event types and emitters. Maintains a Node.js `EventEmitter` singleton for server-side listeners and attempts a Tauri `emit_all()` broadcast for each event so the WebView frontend receives status updates. The Tauri emit is a dynamic import that silently no-ops outside Tauri environments (tests, plain Next.js dev).

Four canonical events: `ghost:status-changed`, `ghost:suggestion-ready`, `ghost:ingest-progress`, `ghost:error`.

### `app/lib/ghost/status.ts`
`GhostStatus` type definition and module-level singleton. `updateGhostStatus()` accepts a partial patch, refreshes live stats from their source of truth (queue depth, active suggestions, poller liveness), and emits `ghost:status-changed`. `addGhostStatusError()` / `clearGhostStatusError()` manage per-component error entries without overwriting state. `resetGhostStatus()` is called at shutdown end.

### `app/lib/ghost/lifecycle.ts`
Core orchestration. Seven-step startup sequence (each step wrapped in `tryStep()` which catches throws, logs, marks degraded, and continues). Reverse shutdown with a `Promise.race()` against a 5-second hard timeout. `pauseGhost()` / `resumeGhost()` set a module-level `_paused` flag and call into email poller and ingest queue explicitly. `restartComponent()` waits 30 seconds then attempts one restart; tracks exhausted components in a `Set` so each gets exactly one retry per session.

### `app/lib/ghost/index.ts`
Public barrel re-exporting `startGhost`, `stopGhost`, `pauseGhost`, `resumeGhost`, `restartComponent`, `isGhostRunning`, `isGhostPaused`, `getGhostStatus`, and all IPC helpers.

### `app/lib/stores/ghost-store.ts`
Zustand store for frontend Ghost state. Holds `ghostStatus: GhostStatus | null` and `ghostSuggestions: GhostSuggestion[]`. Actions: `setGhostStatus`, `addGhostSuggestion`, `dismissGhostSuggestion`, `clearGhostSuggestions`. Hydrated by Tauri event listeners in a React `useEffect`.

---

## Files Modified

### `app/lib/ghost/email/poller.ts`
Added `_explicitPause` module flag. `pauseEmailPoller()` sets it; `resumeEmailPoller()` clears it. `runPoll()` checks `_explicitPause` before the existing AEGIS-signal check. `isPollerRunning()` now returns `false` when explicitly paused. This gives the lifecycle manager direct control independent of the AEGIS signal read path.

### `app/lib/ghost/ingest/index.ts`
Exported `pauseIngestQueue()` and `resumeIngestQueue()` as thin wrappers over `_queue.pause()` / `_queue.resume()` — the class-level methods that were already implemented in Sprint 6C but never surfaced as standalone exports.

### `app/lib/aegis/index.ts`
`switchProfile()` now calls `pauseGhost()` / `resumeGhost()` from `lifecycle.ts` alongside the existing `ghostPause()` / `ghostResume()` from `watcher-bridge.ts`. The two pairs target different layers: watcher-bridge hits the Tauri/Rust side; lifecycle hits the Node.js side (email poller, ingest queue).

### `app/lib/stores/index.ts`
Added `export { useGhostStore } from './ghost-store'` to the barrel.

---

## Startup Sequence (measured on app open)

1. Load watch paths from `kernl_settings` table (falls back to empty array gracefully)
2. `startIngestQueue()` — queue ready to accept items before watcher fires
3. `getUserExclusions()` — primes 5-min Layer 4 cache before any files are ingested
4. `startWatching(paths)` — Rust watcher begins emitting file change events
5. `startEmailPoller()` — 15-minute interval begins (skips silently if no connectors authenticated)
6. `startScorerSchedule()` — fires immediately then every 6h
7. `updateGhostStatus({ state: 'running' })` — IPC broadcast, Zustand store updated

Any step failure: error logged to `ghost:error` IPC, component marked degraded, next step proceeds. A partially-started Ghost continues operating its healthy components.

---

## Shutdown Sequence (measured on app close)

Hard timeout: 5 seconds. `Promise.race([shutdown(), 5s timer])`.

1. `stopScorerSchedule()`
2. `stopEmailPoller()`
3. `stopWatching()` (async, Tauri IPC)
4. `stopIngestQueue()` (items retained in memory)
5. `resetGhostStatus()` → emits `ghost:status-changed { state: 'stopped' }`

Each step is individually try-caught — one component hanging does not block the others from receiving their stop signal before the timeout fires.

---

## AEGIS Propagation

`switchProfile()` in `aegis/index.ts` now propagates to all Ghost layers within the same call:

- `PARALLEL_BUILD` / `COUNCIL` → `ghostPause()` (Rust watcher pauses) + `pauseGhost()` (email poller + ingest queue pause, status emitted as 'paused')
- Any other profile → `ghostResume()` (Rust watcher resumes) + `resumeGhost()` (email poller + ingest queue resume, status emitted as 'running')

---

## Test Infrastructure

`lifecycle.test.ts` uses `vi.resetModules()` + dynamic `await import('../lifecycle')` pattern (`freshLifecycle()`) to get a clean module instance per test. This is necessary because lifecycle.ts holds `_started` and `_paused` as module-level booleans that persist across test runs if the module is imported at the top level.

All 26 tests cover: startup order, idempotency, degraded component propagation, `ghost:error` emission, shutdown order, 5s timeout race, pause/resume idempotency, state flag accuracy, component restart delay and exhaustion.

---

## Key Technical Decisions

- **EventEmitter + Tauri emit_all dual broadcast**: Server-side Node.js listeners (tests, future server routes) use the EventEmitter. The WebView frontend uses Tauri events. A single `emit()` helper fires both so callers don't need to know which environment they're in.
- **getUserExclusions() for cache priming**: `loadExclusions()` in `layer4.ts` is an internal function. The public `getUserExclusions()` was the correct cache-priming entry point — calling it in startup step 3 ensures the 5-min TTL cache is warm before the first file change event arrives.
- **_explicitPause separate from AEGIS-signal pause**: The poller already reads `getLatestAegisSignal()` on every tick. Adding a second `_explicitPause` flag gives the lifecycle manager direct control without modifying the AEGIS signal store. Both mechanisms coexist: explicit pause is checked first (cheaper), AEGIS signal is checked second.
- **Promise.race() for shutdown timeout**: The simplest, most readable pattern. The timeout resolver logs the warning but resolves (not rejects) so the caller's `await` always completes.
- **Single restart attempt per component**: A component that crashes and then fails its restart stays degraded until app restart. Tracked via a `Set<string>` of exhausted component names. This prevents restart storms.
