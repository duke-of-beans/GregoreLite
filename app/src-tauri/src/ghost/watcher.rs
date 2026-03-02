// Ghost Thread — Rust Filesystem Watcher
//
// Uses notify v6 RecommendedWatcher (OS-native: inotify/FSEvents/ReadDirectoryChangesW).
// All path-level filtering (should_exclude) runs in the notify callback before
// any event reaches the debouncer. The debouncer applies 750ms/1500ms timing.
// The paused flag suppresses Tauri IPC emission without destroying watcher state.

use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use notify::event::ModifyKind;
use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tauri::{AppHandle, Emitter};

use crate::ghost::debouncer::{EmitFn, GhostDebouncer};
use crate::ghost::events::{FileChangeEvent, FileChangeKind};
use crate::ghost::exclusions::should_exclude;

// ── WatcherHandle ─────────────────────────────────────────────────────────────

/// Holds the live watcher and its associated state.
/// RAII: dropping this stops OS-level watching and signals the debouncer to exit.
struct WatcherHandle {
    _watcher: RecommendedWatcher,
    _debouncer: Arc<GhostDebouncer>,
    paused: Arc<AtomicBool>,
}

// ── GhostWatcherState ─────────────────────────────────────────────────────────

/// Tauri-managed state for the Ghost filesystem watcher.
/// Wrapped in `Mutex<GhostWatcherState>` and registered via `.manage()` in main.rs.
pub struct GhostWatcherState {
    handle: Option<WatcherHandle>,
}

impl GhostWatcherState {
    pub fn new() -> Self {
        GhostWatcherState { handle: None }
    }

    /// Start watching the given paths.
    /// If already watching, stops the current watcher first.
    pub fn start(&mut self, paths: Vec<String>, app: AppHandle) -> Result<(), String> {
        // Stop existing watcher if present
        if self.handle.is_some() {
            self.handle = None;
        }

        let paused = Arc::new(AtomicBool::new(false));
        let paused_emit = paused.clone();
        let app_emit = app.clone();

        // Emit callback: suppressed when paused
        let emit_fn: EmitFn = Arc::new(move |event: FileChangeEvent| {
            if !paused_emit.load(Ordering::Relaxed) {
                let _ = app_emit.emit("ghost:file-changed", &event);
            }
        });

        let debouncer = Arc::new(GhostDebouncer::new(emit_fn));
        let debouncer_cb = debouncer.clone();

        // Create the notify watcher
        let mut watcher = RecommendedWatcher::new(
            move |result: notify::Result<Event>| {
                if let Ok(event) = result {
                    for path in event.paths {
                        if should_exclude(&path) {
                            continue;
                        }
                        let kind = map_event_kind(&event.kind);
                        debouncer_cb.push(path, kind);
                    }
                }
            },
            Config::default(),
        )
        .map_err(|e| format!("Failed to create watcher: {e}"))?;

        // Watch each requested path recursively (skip non-existent)
        for path_str in &paths {
            let path = PathBuf::from(path_str);
            if path.exists() {
                watcher
                    .watch(&path, RecursiveMode::Recursive)
                    .map_err(|e| format!("Failed to watch {path_str}: {e}"))?;
            }
        }

        self.handle = Some(WatcherHandle {
            _watcher: watcher,
            _debouncer: debouncer,
            paused,
        });

        Ok(())
    }

    /// Stop the watcher and release all resources.
    pub fn stop(&mut self) {
        self.handle = None;
    }

    /// Pause event emission. The watcher keeps running; events are collected
    /// by the debouncer but not emitted to the frontend until resumed.
    pub fn pause(&self) {
        if let Some(handle) = &self.handle {
            handle.paused.store(true, Ordering::Relaxed);
        }
    }

    /// Resume event emission after a pause.
    pub fn resume(&self) {
        if let Some(handle) = &self.handle {
            handle.paused.store(false, Ordering::Relaxed);
        }
    }
}

// ── Event kind mapping ────────────────────────────────────────────────────────

fn map_event_kind(kind: &EventKind) -> FileChangeKind {
    match kind {
        EventKind::Create(_) => FileChangeKind::Created,
        EventKind::Remove(_) => FileChangeKind::Deleted,
        EventKind::Modify(ModifyKind::Name(_)) => FileChangeKind::Renamed,
        EventKind::Modify(_) => FileChangeKind::Modified,
        _ => FileChangeKind::Modified,
    }
}
