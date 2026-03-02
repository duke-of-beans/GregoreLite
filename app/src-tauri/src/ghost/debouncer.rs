// Ghost Thread — Custom Debouncer
//
// Debounce logic: emit a FileChangeEvent only when:
//   - The file has been stable for MIN_DEBOUNCE_MS (750ms idle)
//   OR
//   - MAX_SETTLE_MS (1500ms) have elapsed since the first event for this file
//
// 5 rapid saves to the same file will produce exactly ONE FileChangeEvent,
// emitted 750ms after the last save (if total < 1500ms) or at 1500ms.
//
// The background flush thread runs at TICK_MS (50ms) granularity and exits
// cleanly when the debouncer is dropped (stop flag via Arc<AtomicBool>).

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use std::thread;

use crate::ghost::events::{FileChangeEvent, FileChangeKind};

const MIN_DEBOUNCE_MS: u128 = 750;
const MAX_SETTLE_MS: u128 = 1500;
const TICK_MS: u64 = 50;

// ── Internal pending event ────────────────────────────────────────────────────

struct Pending {
    kind: FileChangeKind,
    first_seen: Instant,
    last_seen: Instant,
}

type PendingMap = Arc<Mutex<HashMap<PathBuf, Pending>>>;

/// Emit callback type: called on the flush thread when a debounced event fires.
pub type EmitFn = Arc<dyn Fn(FileChangeEvent) + Send + Sync + 'static>;

// ── Debouncer ─────────────────────────────────────────────────────────────────

pub struct GhostDebouncer {
    pending: PendingMap,
    stop: Arc<AtomicBool>,
}

impl GhostDebouncer {
    /// Create a new debouncer. Spawns a background flush thread.
    /// The thread exits when the debouncer is dropped (stop flag set in Drop).
    pub fn new(emit: EmitFn) -> Self {
        let pending: PendingMap = Arc::new(Mutex::new(HashMap::new()));
        let stop = Arc::new(AtomicBool::new(false));

        // Clones for the background thread
        let pending_thread = pending.clone();
        let stop_thread = stop.clone();

        thread::spawn(move || {
            loop {
                if stop_thread.load(Ordering::Relaxed) {
                    break;
                }

                thread::sleep(Duration::from_millis(TICK_MS));

                let now = Instant::now();
                let mut map = pending_thread
                    .lock()
                    .expect("debouncer mutex poisoned");

                let mut ready: Vec<(PathBuf, FileChangeKind)> = Vec::new();

                map.retain(|path, pending| {
                    let idle_ms = now.duration_since(pending.last_seen).as_millis();
                    let total_ms = now.duration_since(pending.first_seen).as_millis();

                    let should_emit =
                        idle_ms >= MIN_DEBOUNCE_MS || total_ms >= MAX_SETTLE_MS;

                    if should_emit {
                        ready.push((path.clone(), pending.kind.clone()));
                        false // remove from pending map
                    } else {
                        true // keep waiting
                    }
                });

                // Release lock before calling emit
                drop(map);

                for (path, kind) in ready {
                    let timestamp_ms = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64;

                    emit(FileChangeEvent {
                        path: path.to_string_lossy().to_string(),
                        kind,
                        timestamp_ms,
                    });
                }
            }
        });

        GhostDebouncer { pending, stop }
    }

    /// Push a raw filesystem event into the debounce window.
    ///
    /// - First event for a path: starts the window (records first_seen).
    /// - Subsequent events: updates kind and last_seen, preserves first_seen.
    pub fn push(&self, path: PathBuf, kind: FileChangeKind) {
        let mut map = self.pending.lock().expect("debouncer mutex poisoned");
        let now = Instant::now();

        map.entry(path)
            .and_modify(|p| {
                p.kind = kind.clone();
                p.last_seen = now;
            })
            .or_insert(Pending {
                kind,
                first_seen: now,
                last_seen: now,
            });
    }
}

impl Drop for GhostDebouncer {
    fn drop(&mut self) {
        // Signal the flush thread to exit on its next tick
        self.stop.store(true, Ordering::Relaxed);
    }
}
