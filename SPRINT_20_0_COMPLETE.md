# SPRINT 20.0 — Ghost Thread Activation — COMPLETE

**Date:** March 6, 2026
**Branch:** main
**tsc:** 0 errors
**Tests:** 1344/1344 (unchanged — no new tests; implementation wires existing Ghost infrastructure)
**cargo check:** 0 errors (2 pre-existing dead_code warnings in aegis/profiles.rs + aegis/timer.rs)
**Laws activated:** Ghost ambient intelligence now live in production

---

## What Shipped

### Task 1: startGhost() wired into bootstrap sequence

`app/lib/bootstrap/index.ts` — Step 6 added to `runBootstrap()` after AEGIS init and cold-start warming:

```typescript
// Step 6: Start Ghost Thread (ambient intelligence)
try {
  const { startGhost } = await import('../ghost');
  await startGhost();
  console.log('[bootstrap] Ghost started');
} catch (err) {
  errors.push(`Ghost startup failed: ...`);
  console.warn('[bootstrap] Ghost startup failed (degraded):', err);
}
```

Non-blocking — Ghost startup failure is logged and the app continues normally. The 7-step lifecycle.ts startup already handles per-component failures with degraded mode.

### Task 2: Ghost shutdown on app close (dual-path)

**Path A — TypeScript (dev mode + Tauri primary):**
`app/app/page.tsx` — `beforeunload` event listener calls `navigator.sendBeacon('/api/ghost/stop', '{}')`. `sendBeacon` is fire-and-forget and works during page unload without blocking navigation.

`app/app/api/ghost/stop/route.ts` — `POST /api/ghost/stop` calls `stopGhost()` from lifecycle.ts (5-second hard timeout, graceful component teardown).

**Path B — Rust (Tauri belt-and-suspenders):**
`app/src-tauri/src/main.rs` — `.on_window_event()` Tauri handler: on `WindowEvent::Destroyed` (window fully torn down), acquires the `GhostState` managed mutex and calls `w.stop()` on the Rust-side watcher directly. Avoids E0597 borrow lifetime issue by cloning `app_handle` before acquiring state lock.

### Task 3: AEGIS ↔ Ghost pause/resume — Already wired

Verified in `app/lib/aegis/index.ts`: Ghost pause/resume calls correctly propagated via Tauri IPC on AEGIS profile switches. No changes needed — Sprint 16.0 preserved the integration when AEGIS moved to Tauri embed.

### Task 4: Rust filesystem watcher — cargo check clean

`cargo check --manifest-path app/src-tauri/Cargo.toml` — passes. The `ghost::GhostState` managed struct remains correctly registered in the Tauri builder. Tauri commands `ghost_start_watching` and `ghost_stop_watching` still registered. 2 pre-existing dead_code warnings in AEGIS modules (unrelated to Ghost).

### Task 5: Watcher → ingest bridge

**`app/components/ghost/GhostFileWatcher.tsx`** — Client component that renders `null` (side-effect only). Subscribes to Tauri `ghost:file-changed` events via `onFileChange()` from `watcher-bridge.ts`. On each event (except `deleted`), POSTs `{ filePath }` to `/api/ghost/ingest-file`. Mounted once in `ContextPanel.tsx`.

**`app/app/api/ghost/ingest-file/route.ts`** — `POST /api/ghost/ingest-file`. Resolves watch root from KERNL settings (`ghost_watch_paths` key, default: D:\Dev/Projects/Work/Research). Calls `ingestFile(filePath, ext, watchRoot)` from the ingest pipeline (async queue — returns immediately). Privacy engine (all 4 layers) runs inside `processFile()` before any content is read or embedded.

**`app/app/api/ghost/start/route.ts`** — `POST /api/ghost/start`. Calls `startGhost()` (idempotent). Used by Settings > Ghost master toggle.

**Dev mode graceful degradation:** `onFileChange()` in `watcher-bridge.ts` uses `listen()` which silently fails without Tauri. No file events fire, no API calls are made. Email poller + scorer still run and provide ambient intelligence.

### Task 6: Privacy engine — verified active

Confirmed in `app/lib/ghost/ingest/index.ts`: `processFile()` runs all 4 privacy layers sequentially before any embedding or DB write:
1. Layer 1: path exclusions (.env, .git, node_modules, *.key, etc.)
2. Layer 2: PII scanner (SSN, credit cards, JWT tokens, API keys)
3. Layer 3: sensitive directories and email subjects
4. Layer 4: user-defined glob rules from `ghost_user_exclusions` KERNL settings

Exclusions are logged to `ghost_exclusion_log` table for Privacy Dashboard audit trail.

### Task 7: Ghost status in StatusBar

`app/components/ui/StatusBar.tsx` — Ghost status chip added between KERNL and ATTN sections.

State → label mapping:
- `running` → `GHOST: Active` (green-400)
- `degraded` → `GHOST: Partial` (amber-400)
- `paused` → `GHOST: Paused` (amber-400)
- `starting` → `GHOST: Starting` (amber-400)
- `stopped`/`error` → `GHOST: Off` (mist/gray)

Tooltip: human-readable description per state (e.g., `"Partial: watcher failed — email + scorer still active"`). Click → dispatches `greglite:open-settings` custom event with `{ section: 'ghost' }`, navigating to Settings > Ghost.

Reads from Zustand `ghost-store` which is updated by `lifecycle.ts` on every state transition.

### Task 8: Settings > Ghost section rework

`app/components/settings/GhostSection.tsx` — complete rework of the previous stub (which showed only "Scan Cadence: Every 5 minutes" and a Privacy Exclusions link).

New layout:
- **Status + Toggle:** colored dot (green/amber/gray) + label + Start Ghost / Stop Ghost button. Calls `/api/ghost/start` or `/api/ghost/stop`. Shows `"…"` during toggle. Button disabled during `starting` state.
- **Degraded warning:** amber callout listing failed components when `state === 'degraded'`.
- **Watched Folders:** fetches `/api/ghost/watch-paths` on mount; renders monospaced path chips.
- **Email connectors:** Gmail and Outlook status from `ghostStatus.emailConnectors.gmail/outlook` (Connected / Not connected).
- **Privacy Exclusions:** button → opens Privacy Dashboard modal via `ui-store.getState().openModal('privacy-dashboard')`.

All labels use jargon-free copy per Sprint 15.2 audit.

---

## Architecture Notes

**Why sendBeacon instead of fetch in beforeunload:** `fetch()` during `beforeunload` is unreliable (browser may cancel it). `sendBeacon` is designed for exactly this use case — fire-and-forget during page unload. Works in both dev mode (browser) and Tauri WebView.

**Why dual shutdown paths:** The TypeScript path handles the normal lifecycle (stop() waits for components to drain). The Rust `Destroyed` event path is a hard fallback — if the JS never gets a chance to run (e.g., OS kill signal), the Rust watcher still stops cleanly.

**Why GhostFileWatcher renders null:** The ingest pipeline is purely server-side (Node.js process, SQLite, fs/promises). The Tauri filesystem events fire in the browser/WebView context. The component is the minimal bridge between those two worlds — no UI needed, just a side-effect subscription.

---

## Quality Gates

| Gate | Result |
|------|--------|
| `startGhost()` called during bootstrap | ✅ |
| `stopGhost()` called on app close (both paths) | ✅ |
| Ghost degrades gracefully in dev mode | ✅ |
| AEGIS profile changes pause/resume Ghost | ✅ (verified, no changes needed) |
| Privacy engine active before indexing | ✅ (4 layers in processFile()) |
| Ghost status visible in StatusBar | ✅ (Active/Partial/Paused/Off + tooltip) |
| Settings panel Ghost section functional | ✅ |
| tsc clean | ✅ 0 errors |
| cargo check clean | ✅ 0 errors |
| All tests pass | ✅ 1344/1344 |

---

## Next

Sprint 21.0 — Spring Animations + Final Polish (Framer Motion). Brief: SPRINT_21_0_BRIEF.md
