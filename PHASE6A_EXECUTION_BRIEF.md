GREGLITE SPRINT 6A - Ghost Thread Rust Filesystem Watcher
Phase 6, Sprint 1 of 9 | First Ghost sprint | March 2, 2026

YOUR ROLE: Build the Rust filesystem watcher using notify v6 crate inside Tauri. Debounce events (750ms min, 1500ms max settle). Enforce directory exclusions in Rust before any IO. Emit file change events to Node.js via Tauri IPC commands. This is the Ghost's eyes. David is CEO. Zero debt, complete implementation.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Dev\CLAUDE_INSTRUCTIONS.md
2. D:\Dev\TECHNICAL_STANDARDS.md
3. D:\Dev\SUBAGENT_ROUTING_PROTOCOL.md
4. D:\Projects\GregLite\DEV_PROTOCOLS.md
5. D:\Projects\GregLite\STATUS.md
6. D:\Projects\GregLite\BLUEPRINT_FINAL.md - section 6 fully, section 6.2 for exclusions and event types
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run
Also verify Tauri builds: cd D:\Projects\GregLite && cargo check (from src-tauri dir)

AUTHORITY PROTOCOL - STOP WHEN:
- notify v6 API is different from v4/v5 - read the notify v6 docs before writing any watcher code
- Tauri IPC between Rust and Node.js requires specific setup not already in the project - design the bridge before implementing
- debounce timing on Windows differs from Linux - test with rapid saves before declaring the debouncer correct
- cargo check produces errors that require Cargo.toml changes - report before modifying dependencies
- Sonnet has failed on the same problem twice → spawn Opus subagent, describe what was tried
- Same fix 3+ times

QUALITY GATES:
1. should_exclude() walks every path component - prevents node_modules/deeply/nested/ slipping through
2. 5 rapid saves to the same file produce exactly ONE FileChangeEvent
3. ghost:file-changed IPC event received in Node.js watcher-bridge.ts
4. AEGIS PARALLEL_BUILD pauses the watcher (ghost_pause Tauri command)
5. Watcher starts and stops cleanly with app lifecycle
6. Default watch paths loaded from KERNL settings ghost_watch_paths
7. pnpm test:run zero failures

SUBAGENT ROUTING:
[HAIKU] Read BLUEPRINT section 6 and extract watch path defaults, exclusion lists, allowed extensions → pass exact file path and section numbers, capture output
[HAIKU] Write types.ts (FileChangeEvent interface) → shape is fully specified below, mechanical write
[HAIKU] Write mod.rs (re-exports only) → content fully specified, mechanical
[HAIKU] KERNL settings migration: INSERT ghost_watch_paths default → SQL specified, mechanical
[HAIKU] Run cargo check + capture first 20 error lines → mechanical execution + output capture
[HAIKU] Run npx tsc --noEmit + capture errors → mechanical
[HAIKU] SESSION END: Update STATUS.md sprint 6A complete, write SPRINT_6A_COMPLETE.md, git commit message to .git\COMMIT_MSG_TEMP, git add/commit -F/push
[SONNET] All Rust implementation: watcher.rs, debouncer.rs, exclusions.rs, events.rs
[SONNET] watcher-bridge.ts: Tauri IPC integration in Node.js
[SONNET] Tauri command registration: ghost_start_watching, ghost_stop_watching, ghost_pause, ghost_resume
[SONNET] AEGIS governor integration (app/lib/aegis/governor.ts modification)
[SONNET] Debugging any cargo/Tauri build failures
[OPUS] Escalation only if Sonnet fails twice on the same problem

FILE LOCATIONS:
  src-tauri/src/ghost/
    watcher.rs       - notify v6 watcher setup, watch path management
    debouncer.rs     - 750ms min / 1500ms max settle debounce
    exclusions.rs    - should_exclude(path) walks every path component
    events.rs        - FileChangeEvent serialization for Tauri IPC
    mod.rs           - re-exports

  app/lib/ghost/
    watcher-bridge.ts  - startWatching(paths), onFileChange(handler), stopWatching()

CARGO DEPENDENCIES (add to src-tauri/Cargo.toml):
  notify = "6"
  notify-debouncer-full = "0.3"
  serde = { version = "1", features = ["derive"] }
  tokio = { version = "1", features = ["full"] }

Read the notify v6 docs before writing watcher.rs. The API changed significantly from v4/v5.

FILECHANGEEVENT TYPE:
  // events.rs
  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct FileChangeEvent {
    pub path: String,
    pub kind: FileChangeKind,
    pub timestamp_ms: u64,
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  #[serde(rename_all = "lowercase")]
  pub enum FileChangeKind {
    Created,
    Modified,
    Deleted,
    Renamed,
  }

  // app/lib/ghost/watcher-bridge.ts
  export interface FileChangeEvent {
    path: string;
    kind: 'created' | 'modified' | 'deleted' | 'renamed';
    timestamp_ms: number;
  }

EXCLUSIONS - must be enforced in Rust before any IO:
Hard-coded directory component exclusions:
  node_modules  .git  target  dist  build  .ssh  .gnupg
  secrets  vault  private  personal  medical  legal

Hard-coded filename exclusions:
  .env  .pem  .key  .p12  .pfx  .cer  .crt
  Any filename containing: password  secret  token  credential

Allowed file extensions only:
  .txt  .md  .ts  .tsx  .js  .py  .rs  .go  .java  .sql
  .json  .yaml  .yml  .pdf  .docx

should_exclude(path: &Path) -> bool:
  Walk EVERY component of the path, not just the filename.
  A file at node_modules/lodash/src/index.ts must be excluded even though
  the filename itself is not on the exclusion list.

TAURI COMMANDS:
  #[tauri::command]
  pub async fn ghost_start_watching(paths: Vec<String>, app: AppHandle) -> Result<(), String>

  #[tauri::command]
  pub async fn ghost_stop_watching(app: AppHandle) -> Result<(), String>

  #[tauri::command]
  pub async fn ghost_pause(app: AppHandle) -> Result<(), String>

  #[tauri::command]
  pub async fn ghost_resume(app: AppHandle) -> Result<(), String>

All four commands must be registered in src-tauri/src/main.rs invoke_handler.

WATCHER BRIDGE (app/lib/ghost/watcher-bridge.ts):
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';

  export async function startWatching(paths: string[]): Promise<void>
  export async function stopWatching(): Promise<void>
  export function onFileChange(handler: (event: FileChangeEvent) => void): () => void
    // returns unlisten function

The bridge listens for 'ghost:file-changed' Tauri events and calls the handler.

DEFAULT WATCH PATHS:
Load from KERNL settings key ghost_watch_paths (JSON array of strings).
If not set, default to: ["D:\\Dev", "D:\\Projects", "D:\\Work", "D:\\Research"]
Store defaults back to KERNL settings on first run.

AEGIS INTEGRATION:
The existing AEGIS governor (app/lib/aegis/governor.ts) must call ghost_pause when
AEGIS profile transitions to PARALLEL_BUILD or COUNCIL, and ghost_resume on return.
Read the existing governor code before modifying - do not duplicate AEGIS logic.

SESSION END:
1. cargo check - zero errors
2. npx tsc --noEmit - zero errors
3. pnpm test:run - zero failures
4. Update STATUS.md - Sprint 6A complete
5. git commit -F .git\COMMIT_MSG_TEMP (message: sprint-6a: Rust filesystem watcher, Ghost Thread eyes)
6. git push
7. Write SPRINT_6A_COMPLETE.md: debounce timing verified, 5 rapid saves → 1 event confirmed, should_exclude() test coverage, AEGIS pause works, any notify v6 API discoveries

GATES CHECKLIST:
- should_exclude() returns true for path containing node_modules at any depth
- should_exclude() returns true for .env file
- should_exclude() returns true for file in secrets/ dir
- should_exclude() returns false for D:\Dev\myproject\src\index.ts
- 5 rapid saves to same file → exactly 1 FileChangeEvent emitted
- ghost:file-changed Tauri event received in watcher-bridge.ts onFileChange handler
- ghost_start_watching Tauri command works
- ghost_stop_watching Tauri command stops all events
- ghost_pause stops events without destroying watcher state
- ghost_resume resumes events after pause
- Default watch paths loaded from / saved to KERNL ghost_watch_paths
- AEGIS PARALLEL_BUILD → ghost_pause called
- AEGIS return to normal → ghost_resume called
- cargo check clean
- pnpm test:run clean
- Commit pushed via cmd -F flag
