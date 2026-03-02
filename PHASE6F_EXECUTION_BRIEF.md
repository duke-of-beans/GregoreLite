GREGLITE SPRINT 6F - Ghost Thread Process Lifecycle + IPC
Phase 6, Sprint 6 of 9 | Sequential after 6E | March 2, 2026

YOUR ROLE: Wire all Ghost components into a managed lifecycle. The Ghost starts when GregLite opens, shuts down cleanly when it closes, and communicates its status to the frontend via IPC. This sprint has no new major features - it connects 6A through 6E into a single cohesive process. David is CEO. Zero debt, complete implementation.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Dev\CLAUDE_INSTRUCTIONS.md
2. D:\Dev\TECHNICAL_STANDARDS.md
3. D:\Dev\SUBAGENT_ROUTING_PROTOCOL.md
4. D:\Projects\GregLite\DEV_PROTOCOLS.md
5. D:\Projects\GregLite\STATUS.md
6. D:\Projects\GregLite\BLUEPRINT_FINAL.md - section 6.1 (Architecture) and 6.6 (Security)
7. D:\Projects\GregLite\SPRINT_6E_COMPLETE.md
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL - STOP WHEN:
- Tauri window close event does not fire reliably on Windows - test before assuming clean shutdown works
- Ghost components have circular initialization dependencies - resolve order before wiring
- Any Ghost component fails to shut down within 5 seconds - this is a hard timeout requirement
- Same fix 3+ times

SUBAGENT ROUTING:
[HAIKU] Write ipc.ts (IPC event type definitions and emitter wrappers) → event names and payloads fully specified, mechanical
[HAIKU] Write status.ts (GhostStatus type + status broadcaster) → type shape specified, Tauri emit_all call mechanical
[HAIKU] Add ghost slice to Zustand store (ghostStatus, ghostSuggestions) → shape specified, mechanical
[HAIKU] Run npx tsc --noEmit + capture errors → mechanical
[HAIKU] SESSION END: Update STATUS.md sprint 6F complete, write SPRINT_6F_COMPLETE.md, git commit message, git add/commit -F/push
[SONNET] lifecycle.ts: startup sequence (7 steps with degraded-component handling), shutdown sequence with 5s timeout
[SONNET] Component restart logic with 30-second delay and single retry
[SONNET] AEGIS governor modification: call Node.js lifecycle pause/resume in addition to existing ghost_pause/ghost_resume
[SONNET] Tauri close-requested hook: stopGhost() with 5-second timeout before allowing close
[SONNET] Wire Tauri event listeners into React useEffect for Zustand store updates
[OPUS] Escalation only if Sonnet fails twice on the same problem

QUALITY GATES:
1. All Ghost components start in correct order on app open
2. All Ghost components shut down cleanly within 5 seconds of app close
3. Ghost status (running/paused/error) accessible from frontend at any time
4. AEGIS signal changes propagate to all Ghost components within 500ms
5. Ghost restarts individual failed components without full restart
6. IPC events emitted for: status change, new suggestion surfaced, ingest progress
7. pnpm test:run zero failures

FILE LOCATIONS:
  app/lib/ghost/
    lifecycle.ts     - orchestrates start/stop/pause/resume for all components
    status.ts        - GhostStatus type, status broadcaster via Tauri events
    ipc.ts           - all Ghost IPC event types and emitters
    index.ts         - public re-export of startGhost(), stopGhost(), getGhostStatus()

STARTUP ORDER:
  1. Load watch paths from KERNL settings
  2. Initialize ingest queue (6C) - must be ready before anything else emits events
  3. Load Layer 4 exclusions from KERNL into privacy engine cache (6D)
  4. Start Rust filesystem watcher via ghost_start_watching (6A)
  5. Start email poller if connectors are authenticated (6B)
  6. Start interrupt scorer schedule (6E)
  7. Emit ghost:status-changed with status: 'running'

Each step must complete successfully before the next begins. If any step fails, log the error, mark that component as degraded, continue with the rest. A degraded Ghost (e.g. email auth expired) still runs its other functions.

SHUTDOWN ORDER (reverse startup, 5-second hard timeout):
  1. Stop scorer schedule
  2. Stop email poller
  3. Stop filesystem watcher (ghost_stop_watching)
  4. Drain ingest queue (process remaining items or discard with log)
  5. Emit ghost:status-changed with status: 'stopped'

GHOST STATUS TYPE:
  export interface GhostStatus {
    state: 'starting' | 'running' | 'paused' | 'degraded' | 'stopped' | 'error';
    watcherActive: boolean;
    emailConnectors: { gmail: boolean; outlook: boolean; };
    ingestQueueDepth: number;
    lastIngestAt: number | null;
    lastScorerRunAt: number | null;
    activeSuggestions: number;
    errors: { component: string; message: string; }[];
  }

IPC EVENTS (all emitted via Tauri emit_all):
  ghost:status-changed     payload: GhostStatus
  ghost:suggestion-ready   payload: GhostSuggestion (from 6E)
  ghost:ingest-progress    payload: { queued: number; processed: number; }
  ghost:error              payload: { component: string; message: string; }

AEGIS INTEGRATION:
When AEGIS profile changes, the Ghost lifecycle manager must propagate to all components:
  - PARALLEL_BUILD or COUNCIL: pause watcher, pause email poller, pause scorer, pause ingest queue
  - Any other profile: resume all components
  - Status update emitted after each transition

The existing AEGIS governor in app/lib/aegis/governor.ts already calls ghost_pause/ghost_resume (added in 6A). Expand this to also call the Node.js-side lifecycle pause/resume functions.

COMPONENT RESTART:
If a component crashes (throws unhandled error), the lifecycle manager catches it, logs to ghost:error, marks the component degraded in GhostStatus, and attempts one restart after a 30-second delay. If the restart also fails, the component stays degraded until app restart.

  async function restartComponent(name: string, startFn: () => Promise<void>): Promise<void>

TAURI APP CLOSE HOOK:
Register a handler on the Tauri 'tauri://close-requested' event. Call stopGhost() before allowing the window to close. The handler should set a 5-second timeout - if Ghost does not shut down in time, close anyway and log the timeout.

  // In src-tauri/src/main.rs or equivalent Tauri setup:
  // Listen for close-requested, call ghost_stop_watching before allowing close

GHOST STATE IN ZUSTAND:
Add ghost slice to the app Zustand store:
  ghostStatus: GhostStatus | null
  ghostSuggestions: GhostSuggestion[]

Wire Tauri event listeners in a React useEffect that updates the store when ghost:status-changed and ghost:suggestion-ready arrive.

SESSION END:
1. npx tsc --noEmit - zero errors
2. pnpm test:run - zero failures
3. Update STATUS.md - Sprint 6F complete
4. git commit -F .git\COMMIT_MSG_TEMP (message: sprint-6f: Ghost process lifecycle, IPC, component orchestration)
5. git push
6. Write SPRINT_6F_COMPLETE.md: startup sequence timing, shutdown timing measured, degraded component scenario tested, AEGIS transition verified

GATES CHECKLIST:
- Ghost starts in correct order on app open
- Ghost shuts down within 5 seconds on app close
- Degraded component (e.g. email auth failure) does not prevent other components from running
- ghost:status-changed fires on every state transition
- ghost:suggestion-ready fires when scorer produces a result
- AEGIS PARALLEL_BUILD pauses all Ghost components within 500ms
- AEGIS returning to normal resumes all components
- Component crash triggers 30-second restart attempt
- Ghost state visible in Zustand store
- Tauri close-requested hook calls stopGhost()
- pnpm test:run clean
- Commit pushed via cmd -F flag
