/**
 * Ghost Ingest File API — Sprint 20.0
 *
 * POST /api/ghost/ingest-file — queues a file change event for Ghost ingest.
 *
 * Called by GhostFileWatcher (client component) when the Tauri filesystem
 * watcher emits a ghost:file-changed event in the WebView. This bridges the
 * client-side Tauri IPC event to the server-side ingest pipeline.
 *
 * The ingest queue is async — this returns immediately after enqueueing.
 * Privacy checks (all 4 layers) run inside processFile() before any content
 * is read or embedded.
 */

import { NextResponse } from 'next/server';
import path from 'path';
import { ingestFile } from '@/lib/ghost/ingest';
import { safeHandler } from '@/lib/api/utils';
import { getDatabase } from '@/lib/kernl/database';

/** Load watch paths from KERNL settings to resolve watchRoot for a given path. */
function resolveWatchRoot(filePath: string): string {
  try {
    const db = getDatabase();
    const row = db
      .prepare(`SELECT value FROM kernl_settings WHERE key = 'ghost_watch_paths' LIMIT 1`)
      .get() as { value: string } | undefined;
    if (row?.value) {
      const parsed = JSON.parse(row.value) as unknown;
      if (Array.isArray(parsed)) {
        const watchPaths = parsed as string[];
        return watchPaths.find((wp) => filePath.startsWith(wp)) ?? '';
      }
    }
  } catch {
    // Fall through to defaults
  }
  // Default watch roots
  for (const root of ['D:\\Dev', 'D:\\Projects', 'D:\\Work', 'D:\\Research']) {
    if (filePath.startsWith(root)) return root;
  }
  return '';
}

export const POST = safeHandler(async (req: Request) => {
  const body = (await req.json()) as { filePath?: string };
  const { filePath } = body;

  if (!filePath) {
    return NextResponse.json({ error: 'filePath required' }, { status: 400 });
  }

  const ext = path.extname(filePath);
  const watchRoot = resolveWatchRoot(filePath);
  ingestFile(filePath, ext, watchRoot);

  return NextResponse.json({ queued: true });
});
