GREGLITE SPRINT 16.0 — AEGIS Embed (Option A)
Port AEGIS resource monitoring into Tauri's Rust backend | March 2026

YOUR ROLE: Embed the AEGIS resource monitoring engine directly into GregLite's Tauri Rust backend. No separate service, no HTTP bridge, no port 8743. GregLite starts → AEGIS starts. GregLite closes → AEGIS stops. One app, one process. David is CEO. Zero debt, Option B Perfection.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Projects\GregLite\STATUS.md
2. D:\Projects\GregLite\DEV_PROTOCOLS.md
3. D:\Projects\GregLite\BLUEPRINT_FINAL.md — read §AEGIS integration sections
4. D:\Dev\aegis\src\ — READ THE FULL AEGIS SOURCE. Understand every module.
5. D:\Dev\aegis\README.md — understand what AEGIS does
6. D:\Dev\aegis\Cargo.toml — dependencies
7. D:\Projects\GregLite\app\src-tauri\src\ — read the existing Tauri Rust code
8. D:\Projects\GregLite\app\src-tauri\Cargo.toml — current Rust dependencies
9. D:\Projects\GregLite\app\lib\aegis\ — the TypeScript client that currently talks to AEGIS over HTTP
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL — STOP WHEN:
- AEGIS has dependencies that conflict with Tauri's Rust version → document and escalate
- A module requires system-level permissions that Tauri doesn't grant → document
- The port is >500 lines of Rust → checkpoint, commit, continue in next session
- Sonnet has failed on the same problem twice → spawn Opus subagent

---

CURRENT STATE:
- AEGIS lives at D:\Dev\aegis\ as a standalone Rust Windows service
- It runs an HTTP server on port 8743 with REST endpoints
- It monitors CPU, IO, network, memory, power via Windows APIs
- It exposes workload profiles: idle, build-mode, deep-research, performance, wartime, presentation
- GregLite talks to it via HTTP from app/lib/aegis/ (TypeScript client → HTTP → AEGIS server)
- The settings panel shows port 8743 and a "Test Connection" button
- When AEGIS is offline, Ghost pauses, background jobs throttle, etc.

TARGET STATE:
- AEGIS core logic runs INSIDE the Tauri process as a Rust module
- GregLite's TypeScript calls AEGIS via Tauri IPC commands (invoke()), not HTTP
- No port 8743, no HTTP server, no connection test needed
- AEGIS starts automatically when GregLite launches
- AEGIS stops cleanly when GregLite closes
- Settings panel shows AEGIS status (always connected), profile selector, resource metrics
- All existing GregLite features that depend on AEGIS signals continue working

---

TASK 1: Audit AEGIS source

Read D:\Dev\aegis\src\ completely. Map every module:
- Resource monitoring (CPU, memory, disk IO, network)
- Profile engine (the 6 profiles and their thresholds)
- Signal dispatch (how profiles trigger changes)
- HTTP server (what endpoints exist, what they return)
- Configuration (how profiles are defined)
- Windows-specific APIs used (which crates?)

Produce a migration plan: which modules port directly, which need adaptation for Tauri context, which can be simplified (e.g., the HTTP server is completely unnecessary).

TASK 2: Add AEGIS Rust modules to Tauri

In D:\Projects\GregLite\app\src-tauri\src\:
- Create an `aegis/` module directory
- Port the resource monitoring code (CPU, memory, IO, network sensors)
- Port the profile engine (profile definitions, threshold logic, switching)
- Port the signal dispatch (notify the frontend when profile changes)
- Do NOT port the HTTP server (replaced by Tauri IPC)
- Add required crate dependencies to Cargo.toml (sysinfo, or whatever AEGIS uses)

The AEGIS module should expose:
```rust
pub fn start_aegis() -> Result<(), AegisError>    // Begin monitoring
pub fn stop_aegis()                                 // Clean shutdown
pub fn get_status() -> AegisStatus                  // Current profile + metrics
pub fn switch_profile(profile: &str) -> Result<(), AegisError>  // Manual override
pub fn get_metrics() -> SystemMetrics               // CPU, mem, IO, network
```

TASK 3: Register Tauri commands

In main.rs, register AEGIS as Tauri commands:
```rust
#[tauri::command]
fn aegis_status() -> AegisStatus { ... }

#[tauri::command]
fn aegis_switch_profile(profile: String) -> Result<(), String> { ... }

#[tauri::command]
fn aegis_metrics() -> SystemMetrics { ... }
```

Start AEGIS monitoring in the Tauri setup hook. Stop it in the on_exit hook.

TASK 4: Update TypeScript AEGIS client

File: app/lib/aegis/

Replace the HTTP client with Tauri IPC:
- `getAEGISStatus()` → `invoke('aegis_status')`
- `switchProfile()` → `invoke('aegis_switch_profile', { profile })`
- Remove all HTTP/fetch code, connection testing, port configuration
- The `isGhostPaused()` and profile checks should work identically — just the transport changes

Add fallback for dev mode (when running `pnpm dev` without Tauri):
- In dev mode, AEGIS IPC won't be available (no Tauri runtime)
- Fall back to a mock/idle state: always return "idle" profile, no metrics
- Log once: "AEGIS: running in dev mode (no Tauri runtime, metrics unavailable)"

TASK 5: Update Settings panel

Remove:
- AEGIS port number input
- "Test Connection" button
- "Connection: ● Offline" status (it's always connected now)

Replace with:
- AEGIS status: "Active" with current profile name
- Profile selector dropdown (manual override)
- Live resource metrics (CPU %, memory %, if available from the Rust module)
- A simple "System Monitor" section header (per Sprint 15.2 jargon audit)

TASK 6: Update tests

- Update any tests that mock the AEGIS HTTP client to mock the Tauri IPC instead
- The existing behavior tests (Ghost pauses on PARALLEL_BUILD, etc.) should pass with the new transport
- Add a test: AEGIS status returns valid data in dev mode (mock fallback)

TASK 7: Verify and commit

1. npx tsc --noEmit — 0 errors
2. pnpm test:run — all passing
3. cargo check (in src-tauri) — 0 errors
4. Verify in dev mode: app starts without AEGIS errors, shows "dev mode" status
5. Update STATUS.md
6. Write SPRINT_16_0_COMPLETE.md
7. Commit: "feat: Sprint 16.0 — AEGIS embedded in Tauri (no external service, IPC-native)"
8. Push

---

QUALITY GATES:
 1. No HTTP calls to port 8743 anywhere in the codebase
 2. AEGIS starts automatically with GregLite
 3. AEGIS stops cleanly on app close
 4. TypeScript client works via Tauri IPC (invoke)
 5. Dev mode falls back gracefully (no crashes, logged once)
 6. Settings panel shows AEGIS as always-connected
 7. Ghost pause/resume still works on profile changes
 8. cargo check clean, tsc clean, all tests pass

NON-NEGOTIABLE RULES:
1. tsc --noEmit 0 errors AND cargo check 0 errors
2. The HTTP server code is NOT ported — IPC replaces it entirely
3. Dev mode MUST work without Tauri (fallback to mock)
4. Use cmd shell (not PowerShell)
5. Read the FULL AEGIS source before writing any Rust code
6. If AEGIS uses Windows-specific APIs that don't work in Tauri context, document the gap and provide a fallback
7. Existing AEGIS-dependent features (Ghost pause, job throttling, workload signals) must continue working identically
