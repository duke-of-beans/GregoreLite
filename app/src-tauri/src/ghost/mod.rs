// Ghost Thread — module root
// Re-exports submodules and declares the four Tauri IPC commands.

pub mod debouncer;
pub mod events;
pub mod exclusions;
pub mod watcher;

use std::sync::Mutex;
use tauri::{AppHandle, State};
use watcher::GhostWatcherState;

// ── Tauri state type alias ────────────────────────────────────────────────────

pub type GhostState = Mutex<GhostWatcherState>;

pub fn ghost_state() -> GhostState {
    Mutex::new(GhostWatcherState::new())
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Start watching the given paths for file changes.
/// Paths that do not exist are silently skipped.
/// If the watcher is already running, it is restarted on the new paths.
#[tauri::command]
pub async fn ghost_start_watching(
    paths: Vec<String>,
    state: State<'_, GhostState>,
    app: AppHandle,
) -> Result<(), String> {
    let mut s = state.lock().map_err(|e| format!("state lock: {e}"))?;
    s.start(paths, app)
}

/// Stop the filesystem watcher and release all OS handles.
#[tauri::command]
pub async fn ghost_stop_watching(
    state: State<'_, GhostState>,
) -> Result<(), String> {
    let mut s = state.lock().map_err(|e| format!("state lock: {e}"))?;
    s.stop();
    Ok(())
}

/// Pause event emission without stopping the watcher.
/// Called by AEGIS when transitioning to PARALLEL_BUILD or COUNCIL.
/// The debouncer continues collecting events; they are held until ghost_resume.
#[tauri::command]
pub async fn ghost_pause(
    state: State<'_, GhostState>,
) -> Result<(), String> {
    let s = state.lock().map_err(|e| format!("state lock: {e}"))?;
    s.pause();
    Ok(())
}

/// Resume event emission after a ghost_pause.
/// Called by AEGIS when workload returns to a non-intensive profile.
#[tauri::command]
pub async fn ghost_resume(
    state: State<'_, GhostState>,
) -> Result<(), String> {
    let s = state.lock().map_err(|e| format!("state lock: {e}"))?;
    s.resume();
    Ok(())
}
