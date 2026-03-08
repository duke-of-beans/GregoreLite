/**
 * Auto-Ingest Handler — Sprint 34.0 / EPIC-81
 *
 * Handles files dropped into the watchfolder:
 *   1. Read + detect format
 *   2. Run appropriate adapter
 *   3. Create imported_sources row
 *   4. Run import pipeline (embed + index)
 *   5. Move to processed/ on success; leave in place on error
 *
 * startAutoIngest() wires the watcher — called from bootstrap.
 * stopAutoIngest() tears it down — called on app shutdown.
 */

import * as fs from 'fs';
import * as path from 'path';
import { nanoid } from 'nanoid';
import { getDatabase } from '@/lib/kernl/database';
import { detectFormat, runAdapter } from './adapters';
import { runImport } from './pipeline';
import { isZipBuffer, extractConversationsJson } from './zip-handler';
import { startWatchfolder, moveToProcessed } from './watchfolder';

let _stop: (() => void) | null = null;

// ── Core handler ──────────────────────────────────────────────────────────────

/**
 * Process a single file that landed in the watchfolder.
 * Never throws — errors are logged and the file is left in place.
 */
export async function handleWatchfolderFile(filePath: string): Promise<void> {
  const filename = path.basename(filePath);
  console.log(`[auto-ingest] Processing: ${filename}`);

  try {
    const buffer = fs.readFileSync(filePath);

    // Detect container type and extract conversation payload
    let content: unknown;
    if (isZipBuffer(buffer)) {
      content = await extractConversationsJson(buffer);
    } else {
      content = JSON.parse(buffer.toString('utf8'));
    }

    const format = detectFormat(filename, content);
    const conversations = runAdapter(format, content);

    if (conversations.length === 0) {
      console.warn(
        `[auto-ingest] No conversations found in ${filename} (format: ${format}) — leaving in place`,
      );
      return;
    }

    const db = getDatabase();
    const sourceId = nanoid();
    const displayName = `${filename} (auto-imported ${new Date().toLocaleDateString()})`;

    db.prepare(
      `INSERT INTO imported_sources
         (id, source_type, display_name, conversation_count, chunk_count, created_at)
       VALUES (?, 'watchfolder', ?, 0, 0, ?)`,
    ).run(sourceId, displayName, Date.now());

    const result = await runImport(sourceId, conversations);

    console.log(
      `[auto-ingest] ✓ ${result.processed} conversations, ${result.chunks_written} chunks indexed from ${filename}`,
    );

    moveToProcessed(filePath);
  } catch (err) {
    console.error(`[auto-ingest] Failed to process ${filename}:`, err);
    // Leave file in watchfolder — user can retry by re-dropping
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

/**
 * Start the auto-ingest watchfolder daemon.
 * Returns a stop function — also stored module-level for stopAutoIngest().
 */
export function startAutoIngest(): () => void {
  const stop = startWatchfolder((filePath) => {
    void handleWatchfolderFile(filePath);
  });
  _stop = stop;
  return stop;
}

/**
 * Stop the auto-ingest watcher and release OS file handles.
 */
export function stopAutoIngest(): void {
  _stop?.();
  _stop = null;
}
