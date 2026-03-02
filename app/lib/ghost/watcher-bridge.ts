/**
 * Ghost Thread — Watcher Bridge (Sprint 6A)
 *
 * Client-side Tauri IPC bridge for the Ghost filesystem watcher.
 * All calls use @tauri-apps/api — only works inside the Tauri WebView.
 * Functions are guarded with try-catch so they silently no-op in
 * non-Tauri environments (tests, SSR, browser-only dev mode).
 *
 * Usage:
 *   const unlisten = onFileChange((event) => { ... });  // subscribe
 *   await startWatching([]);                             // start (loads KERNL paths)
 *   await stopWatching();                               // stop
 *   unlisten();                                         // unsubscribe handler
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FileChangeEvent {
  path: string;
  kind: 'created' | 'modified' | 'deleted' | 'renamed';
  timestamp_ms: number;
}

// ── Default watch paths ───────────────────────────────────────────────────────

const DEFAULT_WATCH_PATHS: string[] = [
  'D:\\Dev',
  'D:\\Projects',
  'D:\\Work',
  'D:\\Research',
];

const GHOST_WATCH_PATHS_KEY = 'ghost_watch_paths';

// ── KERNL settings helpers ────────────────────────────────────────────────────

/**
 * Load watch paths from KERNL settings via the Next.js API.
 * Falls back to DEFAULT_WATCH_PATHS if not set or on error.
 * Stores defaults back to KERNL on first run.
 */
async function loadWatchPaths(): Promise<string[]> {
  try {
    const res = await fetch(
      `/api/ghost/settings?key=${GHOST_WATCH_PATHS_KEY}`,
    );
    if (!res.ok) return DEFAULT_WATCH_PATHS;

    const data = (await res.json()) as { value: string[] | null };
    if (Array.isArray(data.value) && data.value.length > 0) {
      return data.value;
    }

    // First run: store defaults
    await fetch('/api/ghost/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: GHOST_WATCH_PATHS_KEY, value: DEFAULT_WATCH_PATHS }),
    });

    return DEFAULT_WATCH_PATHS;
  } catch {
    return DEFAULT_WATCH_PATHS;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Start the Ghost filesystem watcher.
 *
 * @param paths Explicit paths to watch. If empty, paths are loaded from
 *              KERNL settings (ghost_watch_paths), defaulting to
 *              D:\Dev, D:\Projects, D:\Work, D:\Research.
 */
export async function startWatching(paths: string[] = []): Promise<void> {
  const watchPaths = paths.length > 0 ? paths : await loadWatchPaths();
  try {
    await invoke('ghost_start_watching', { paths: watchPaths });
  } catch (err) {
    console.error('[ghost] startWatching failed:', err);
  }
}

/**
 * Stop the Ghost filesystem watcher and release all OS handles.
 */
export async function stopWatching(): Promise<void> {
  try {
    await invoke('ghost_stop_watching');
  } catch (err) {
    console.error('[ghost] stopWatching failed:', err);
  }
}

/**
 * Subscribe to file change events emitted by the Ghost watcher.
 * Returns an unlisten function — call it to unsubscribe.
 *
 * @example
 *   const unlisten = onFileChange((event) => console.log(event));
 *   // later:
 *   unlisten();
 */
export function onFileChange(
  handler: (event: FileChangeEvent) => void,
): () => void {
  let unlistenFn: UnlistenFn | null = null;

  listen<FileChangeEvent>('ghost:file-changed', (tauriEvent) => {
    handler(tauriEvent.payload);
  })
    .then((fn) => {
      unlistenFn = fn;
    })
    .catch((err) => {
      console.error('[ghost] onFileChange listen failed:', err);
    });

  return () => {
    unlistenFn?.();
  };
}

/**
 * Pause Ghost event emission. Called by AEGIS on intensive workload profiles.
 * The watcher keeps running; debounced events are held until ghostResume().
 */
export async function ghostPause(): Promise<void> {
  try {
    await invoke('ghost_pause');
  } catch {
    // No-op in non-Tauri environments (tests, SSR)
  }
}

/**
 * Resume Ghost event emission after a ghostPause().
 * Called by AEGIS when workload returns to a non-intensive profile.
 */
export async function ghostResume(): Promise<void> {
  try {
    await invoke('ghost_resume');
  } catch {
    // No-op in non-Tauri environments (tests, SSR)
  }
}
