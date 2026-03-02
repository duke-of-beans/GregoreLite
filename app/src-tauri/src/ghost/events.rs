// Ghost Thread — FileChangeEvent IPC types
// Serialized via Tauri IPC to Node.js watcher-bridge.ts

use serde::{Deserialize, Serialize};

/// Event emitted to the frontend via Tauri IPC event "ghost:file-changed"
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChangeEvent {
    pub path: String,
    pub kind: FileChangeKind,
    pub timestamp_ms: u64,
}

/// The nature of the filesystem change.
/// Serialized as lowercase strings: "created", "modified", "deleted", "renamed"
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FileChangeKind {
    Created,
    Modified,
    Deleted,
    Renamed,
}
