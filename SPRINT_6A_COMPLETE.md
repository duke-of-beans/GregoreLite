# SPRINT 6A COMPLETE — Rust Filesystem Watcher

**Date:** March 2, 2026  
**Sprint:** 6A — Ghost Thread: Eyes Open  
**Commit:** `sprint-6a: Rust filesystem watcher, Ghost Thread eyes`

---

## What Was Built

Sprint 6A wires the Ghost Thread's eyes: a native Rust filesystem watcher embedded in the Tauri backend that watches David's work directories, debounces raw OS events, enforces security exclusions entirely in Rust before any IO reaches TypeScript, and emits structured `FileChangeEvent` objects to the Next.js layer via Tauri IPC.

### Rust Layer (`app/src-tauri/src/ghost/`)

**`events.rs`** — `FileChangeEvent { path, kind, timestamp_ms }` and `FileChangeKind { Created, Modified, Deleted, Renamed }`. Both `Serialize + Deserialize` for clean JSON over Tauri IPC.

**`exclusions.rs`** — `should_exclude(path: &Path) -> bool`. Walks every path component (not just the filename) to prevent deeply nested bypass attacks. Guards: 12 directory names (`node_modules`, `.git`, `target`, `secrets`, etc.), 6 security extensions (`.pem`, `.key`, `.p12`, etc.), 4 filename keywords (`password`, `secret`, `token`, `credential`), dotfile detection, and an extension allowlist (`txt`, `md`, `ts`, `tsx`, `js`, `py`, `rs`, `go`, `java`, `sql`, `json`, `yaml`, `yml`, `pdf`, `docx`). 25 unit tests.

**`debouncer.rs`** — Custom `GhostDebouncer`. `notify-debouncer-full` only supports idle-timeout debouncing; the dual-constraint spec (750ms idle OR 1500ms from first event) requires tracking both `first_seen` and `last_seen` per path. Background flush thread with 50ms tick, `Arc<AtomicBool>` stop flag cleaned up in `Drop`.

**`watcher.rs`** — `GhostWatcherState` wrapping a `notify::RecommendedWatcher`. Start/stop/pause/resume lifecycle. The callback checks `should_exclude()`, maps `EventKind` to `FileChangeKind`, calls `debouncer.push()`. Pause is a soft pause — the watcher keeps running but drops events at the debouncer push point.

**`mod.rs`** — Four `#[tauri::command]` functions: `ghost_start_watching`, `ghost_stop_watching`, `ghost_pause`, `ghost_resume`. `GhostState = Mutex<GhostWatcherState>` registered in `main.rs`.

### TypeScript Layer (`app/lib/ghost/`)

**`lib/kernl/settings-store.ts`** — Generic settings persistence: `getSetting/setSetting/deleteSetting` + JSON variants. Queries the `settings` table (key/value) in KERNL SQLite.

**`app/api/ghost/settings/route.ts`** — `GET /api/ghost/settings?key=X` and `POST /api/ghost/settings` — bridge between the client-side watcher bridge and server-side KERNL access.

**`lib/ghost/watcher-bridge.ts`** — Full Tauri IPC bridge. `startWatching(paths?)` loads paths from KERNL settings on first run (stores defaults: `D:\Dev`, `D:\Projects`, `D:\Work`, `D:\Research`), then calls `invoke('ghost_start_watching')`. `onFileChange(handler)` calls `listen('ghost:file-changed', ...)` and returns the unlisten function. `ghostPause`/`ghostResume` wrap invoke in try-catch for safe no-op outside Tauri.

**`lib/aegis/index.ts`** — PARALLEL_BUILD and COUNCIL profiles trigger `ghostPause()`; all other profiles trigger `ghostResume()`. Ghost goes quiet when compute-intensive workloads are running.

### Test Coverage

19 new tests in `lib/ghost/__tests__/watcher-bridge.test.ts`:
- `startWatching`: paths provided, KERNL load, fetch fallback, invoke failure resilience
- `stopWatching`: invoke + resilience
- `onFileChange`: listen setup, unlisten return, handler fires on event
- `ghostPause`/`ghostResume`: invoke + non-Tauri resilience
- AEGIS → Ghost integration: PARALLEL_BUILD/COUNCIL → pause, IDLE/DEEP_FOCUS/COWORK_BATCH → resume

---

## Gate Results

| Gate | Result |
|------|--------|
| `cargo check` | ✅ 0 errors, 0 warnings |
| `npx tsc --noEmit` | ✅ 0 errors |
| `pnpm test:run` | ✅ 603/603 (31 test files) |

---

## Key Technical Discoveries

**notify v6 EventKind mapping**: `ModifyKind::Name(_)` handles renames. `ModifyKind::Data(_)` handles writes. `EventKind::Any` used as fallback → `Modified`.

**Custom debouncer was necessary**: `notify-debouncer-full` only implements idle-timeout. The 750ms-idle / 1500ms-max dual constraint requires per-path `first_seen` tracking in a `HashMap<PathBuf, Pending>`.

**Path component walking is non-negotiable**: Checking `path.file_name()` only allows `node_modules/a/b/c.ts` through. Must walk all components.

**AEGIS→Ghost server/client boundary**: AEGIS runs server-side (Node.js); `invoke()` is client-side (Tauri WebView). Ghost pause/resume wrapped in try-catch — silent no-op in Node.js, functional in WebView.

**vi.fn generic syntax (vitest v4)**: `vi.fn<[ArgTuple], ReturnType>()` is invalid (0-1 type args only). Use `vi.fn() as any`. Pull captured callbacks via `mock.calls[0]?.[1]` — not `mockImplementationOnce` with a captured variable (TypeScript CFA doesn't track callback assignments).

**rustup default stable**: May not be set on fresh Windows installs. `rustup default stable` required before first `cargo` invocation.

---

## Next: Sprint 6B — Email Connectors (Gmail + Outlook OAuth)
