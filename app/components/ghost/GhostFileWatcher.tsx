import { apiFetch } from '@/lib/api-client';
'use client';

/**
 * GhostFileWatcher — Sprint 20.0
 *
 * Client-side bridge: Tauri ghost:file-changed events → /api/ghost/ingest-file.
 *
 * Architecture: The Rust filesystem watcher (ghost/watcher.rs) emits
 * ghost:file-changed Tauri events into the WebView. The ingest pipeline
 * runs server-side (Node.js, uses SQLite + fs/promises). This component
 * bridges the gap: subscribes to Tauri events client-side, POSTs each file
 * path to the server-side API route which calls ingestFile().
 *
 * Renders nothing — mount once in ContextPanel.
 *
 * Dev mode (no Tauri): onFileChange's listen() call fails silently (.catch
 * in watcher-bridge.ts). No events fire, no API calls are made — correct
 * graceful degradation. Email poller + scorer still provide ambient intelligence.
 *
 * Deleted files are skipped — there is nothing to ingest.
 * Renamed files: 'renamed' kind is treated as a new file (re-ingested).
 */

import { useEffect } from 'react';
import { onFileChange } from '@/lib/ghost/watcher-bridge';

export function GhostFileWatcher() {
  useEffect(() => {
    const unlisten = onFileChange(async (event) => {
      // Skip deleted files — nothing to ingest
      if (event.kind === 'deleted') return;

      try {
        await apiFetch('/api/ghost/ingest-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: event.path }),
        });
      } catch {
        // Non-critical — ingest failure is logged server-side via ingest queue
      }
    });

    return () => {
      unlisten();
    };
  }, []);

  // Renders nothing — this component is purely a side-effect bridge
  return null;
}
