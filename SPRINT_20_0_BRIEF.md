GREGLITE SPRINT 20.0 — Ghost Thread Activation
Wire Ghost to app lifecycle, verify end-to-end ambient intelligence | March 2026

YOUR ROLE: Ghost Thread was built across 9 sprints (Phase 6: 6A–6I) but was never wired to the app lifecycle. startGhost() is never called. This sprint activates Ghost for real daily use: filesystem watching, email polling, ingest pipeline, proactive suggestions, and the full scorer. David is CEO. Zero debt.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Projects\GregLite\STATUS.md
2. D:\Projects\GregLite\DEV_PROTOCOLS.md
3. D:\Projects\GregLite\app\lib\ghost\lifecycle.ts — READ FULLY (7-step startup, 5s shutdown, degraded mode)
4. D:\Projects\GregLite\app\lib\ghost\index.ts — public API (startGhost, stopGhost, pauseGhost, resumeGhost)
5. D:\Projects\GregLite\app\lib\ghost\watcher-bridge.ts — Tauri IPC for filesystem watching
6. D:\Projects\GregLite\app\lib\ghost\email\poller.ts — 15-minute email poller
7. D:\Projects\GregLite\app\lib\ghost\ingest\index.ts — unified ingest pipeline
8. D:\Projects\GregLite\app\lib\ghost\scorer\index.ts — proactive suggestion scorer
9. D:\Projects\GregLite\app\lib\ghost\privacy\ — 4-layer privacy exclusion engine
10. D:\Projects\GregLite\app\lib\ghost\status.ts — GhostStatus type
11. D:\Projects\GregLite\app\lib\stores\ghost-store.ts — Zustand store
12. D:\Projects\GregLite\app\components\ghost\ — GhostCard, GhostCardList, GhostStatusBadge, TeachGhostDrawer
13. D:\Projects\GregLite\app\lib\bootstrap\index.ts — current bootstrap sequence (Ghost not called)
14. D:\Projects\GregLite\app\app\page.tsx — app entry point
15. D:\Projects\GregLite\app\lib\aegis\index.ts — AEGIS integration (Ghost pause/resume on profile change)
16. D:\Projects\GregLite\app\src-tauri\src\ghost\ — Rust filesystem watcher module
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL — STOP WHEN:
- Ghost depends on Tauri IPC for filesystem watching — in dev mode (pnpm dev, no Tauri), the watcher will fail. Ghost must degrade gracefully: skip the watcher step, continue with email + scorer + ingest. Document this in the startup log.
- Email connectors require OAuth tokens stored in keychain. If no tokens exist, email polling should skip silently (not error). Ghost works with partial components.
- If Ghost ingest starts indexing D:\Dev, D:\Projects, D:\Work, D:\Research — that's a LOT of files. Verify the AEGIS throttling (500ms budget, 30-min cadence) is active so it doesn't overwhelm the system.
- Sonnet has failed on the same problem twice → spawn Opus subagent

---

TASK 1: Wire startGhost() into bootstrap sequence

File: app/lib/bootstrap/index.ts

In `runBootstrap()`, after AEGIS init and cold-start warming, add:

```typescript
// Step 6: Start Ghost Thread (ambient intelligence)
try {
  const { startGhost } = await import('../ghost');
  await startGhost();
  console.log('[bootstrap] Ghost started');
} catch (err) {
  errors.push(`Ghost startup failed: ${err instanceof Error ? err.message : String(err)}`);
  console.warn('[bootstrap] Ghost startup failed (degraded):', err);
}
```

Ghost startup is non-blocking for the UI — if it fails, the app still works. The 7-step startup in lifecycle.ts already handles per-component failures gracefully (degraded mode).

TASK 2: Wire stopGhost() into app shutdown

Ghost must stop cleanly when the app closes. Two paths:

Path A (Tauri): In `src-tauri/src/main.rs`, the Tauri `on_window_event` fires on close. Add a Tauri command `stop_ghost` that calls into the Ghost lifecycle. The TypeScript side invokes this during the beforeunload handler.

Path B (Dev mode): In page.tsx or a layout component, add a `beforeunload` event listener that calls `POST /api/ghost/stop`. Create this API route if it doesn't exist.

New API route (if needed): app/app/api/ghost/stop/route.ts
```typescript
import { stopGhost } from '@/lib/ghost';
export const POST = safeHandler(async () => {
  await stopGhost();
  return successResponse({ stopped: true });
});
```

TASK 3: Wire AEGIS ↔ Ghost integration

File: app/lib/aegis/index.ts

Sprint 16.0 embedded AEGIS in Tauri. Verify that the AEGIS → Ghost pause/resume pathway still works:
- When AEGIS switches to PARALLEL_BUILD or COUNCIL profile → call pauseGhost()
- When AEGIS switches to any other profile → call resumeGhost()

This was designed in Sprint 6A/6F but may need re-wiring since AEGIS is now embedded (Tauri IPC instead of HTTP). Read the current AEGIS integration code and verify the Ghost pause/resume calls are still connected.

TASK 4: Verify filesystem watcher in Tauri context

The Ghost filesystem watcher uses Tauri's Rust `notify` crate (Sprint 6A). With AEGIS now embedded in Tauri (Sprint 16.0), verify:
1. The Ghost Rust watcher module still compiles (cargo check)
2. The Tauri commands for `ghost_start_watching`, `ghost_stop_watching` are still registered
3. The watcher-bridge.ts TypeScript IPC calls still work
4. Default watch paths (D:\Dev, D:\Projects, D:\Work, D:\Research) are loaded from KERNL settings

In dev mode (no Tauri), the watcher should fail with a logged warning and Ghost should continue in degraded mode (email + scorer still active).

TASK 5: Verify Ghost suggestion surfacing end-to-end

The full pipeline: file change → ingest → embed → vector index → scorer → suggestion card

1. Verify the Ghost scorer schedule starts (6-hour cadence from Sprint 6E)
2. Verify scorer reads from content_chunks (Phase 3 vector index)
3. Verify suggestions surface via the ghost-store Zustand store
4. Verify GhostCardList component renders in the chat interface (Sprint 6H)
5. Verify "Tell me more" on a Ghost card injects context into the conversation

If the vector index is empty (fresh DB), the scorer will find no matches — that's correct. Suggestions will appear once files are indexed.

TASK 6: Verify privacy exclusion engine

The 4-layer privacy engine (Sprint 6D) protects sensitive files from being indexed:
1. Layer 1: path exclusions (.env, .git, node_modules, etc.)
2. Layer 2: PII scanner (SSN, credit cards, API keys, JWT)
3. Layer 3: sensitive directories and email subjects
4. Layer 4: user-defined rules (micromatch globs from Settings > Ghost > Privacy)

Verify each layer is active in the ingest pipeline. Quick test: create a test file at D:\Dev\test-ghost-exclude\secret.env — it should be excluded by Layer 1. Check the exclusion log (ghost_exclusion_log table).

TASK 7: Ghost status in UI

Verify Ghost status appears correctly in the app:
1. StatusBar should show Ghost state (use the existing GhostStatusBadge or status indicator)
2. Settings > Ghost section should show: watch paths, email connection status, privacy rules
3. Context panel or Inspector should show Ghost suggestions when available

If Ghost status isn't visible in the StatusBar, add it. Use the VOICE system for status labels:
- Running → "Ghost: Active" (with tooltip "Monitoring filesystem and email for relevant context")
- Degraded → "Ghost: Partial" (with tooltip listing which components failed)
- Paused → "Ghost: Paused" (with tooltip "Paused due to high system load")
- Stopped → "Ghost: Off"

TASK 8: Settings panel Ghost configuration

File: app/components/settings/GhostSection.tsx (exists from Sprint 6G)

Verify and update:
- Watch paths: list of directories Ghost monitors, add/remove UI
- Email connections: Gmail / Outlook status (connected / not configured)
- Privacy rules: Layer 4 user exclusions (add glob patterns)
- Ghost toggle: master on/off switch
- All labels use VOICE system / Sprint 15.2 jargon-free copy

TASK 9: Verify and commit

1. npx tsc --noEmit — 0 errors
2. cargo check (in src-tauri) — 0 errors (if Tauri watcher was modified)
3. pnpm test:run — all passing
4. Verify: app starts → Ghost status shows "Active" (or "Partial" in dev mode)
5. Verify: Ghost suggestions appear after files are indexed (may need to wait for scorer cycle)
6. Verify: settings panel shows Ghost configuration
7. Verify: app close → Ghost stops cleanly (check console for shutdown log)
8. Update STATUS.md
9. Write SPRINT_20_0_COMPLETE.md
10. Commit: "feat: Sprint 20.0 — Ghost Thread activation (lifecycle wired, filesystem + email + scorer running)"
11. Push

---

QUALITY GATES:
 1. startGhost() called during bootstrap
 2. stopGhost() called on app close (both Tauri and dev mode)
 3. Ghost degrades gracefully in dev mode (no Tauri watcher, everything else works)
 4. AEGIS profile changes pause/resume Ghost correctly
 5. Privacy engine active (Layer 1-4 all functional)
 6. Ghost status visible in StatusBar
 7. Settings panel Ghost section functional
 8. tsc clean, cargo check clean, all tests pass

NON-NEGOTIABLE RULES:
1. tsc --noEmit 0 errors
2. Ghost startup NEVER blocks the UI — failures are logged and degraded, not thrown
3. Dev mode must work WITHOUT the Tauri filesystem watcher (graceful degradation)
4. Privacy engine must be active BEFORE any indexing starts
5. Use cmd shell (not PowerShell)
6. Read lifecycle.ts FULLY — understand the 7-step startup before modifying bootstrap
7. AEGIS is now embedded (Sprint 16.0) — verify the pause/resume IPC path still works
