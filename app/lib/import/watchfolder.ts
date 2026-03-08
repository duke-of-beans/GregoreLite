/**
 * Watchfolder Watcher — Sprint 34.0 / EPIC-81
 *
 * Watches the configured import folder for new .json/.zip files.
 * Uses Node.js fs.watch() — runs server-side in the Next.js backend.
 * Tauri-specific notification hooks are handled by auto-ingest.ts.
 *
 * 500ms debounce per file prevents triggering before the write completes.
 * Only 'rename' events that result in an existing file trigger onFile().
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  getWatchfolderPath,
  getProcessedDir,
  SUPPORTED_EXTENSIONS,
  ensureWatchfolderExists,
} from './watchfolder-config';

const DEBOUNCE_MS = 500;

// Module-level stop fn — stored so stopWatchfolder() can reach it.
let _stopFn: (() => void) | null = null;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Start watching the configured watchfolder for new export files.
 * Calls onFile(absolutePath) for each new .json or .zip file after a
 * 500ms debounce (giving the OS time to finish writing the file).
 *
 * Returns a stop function — call it to close the watcher.
 */
export function startWatchfolder(onFile: (filePath: string) => void): () => void {
  const watchfolderPath = getWatchfolderPath();
  ensureWatchfolderExists(watchfolderPath);

  const pendingFiles = new Map<string, ReturnType<typeof setTimeout>>();

  // fs.watch emits 'rename' for both creates and deletes on Windows/Linux
  const watcher = fs.watch(
    watchfolderPath,
    { persistent: false },
    (_eventType, filename) => {
      if (!filename) return;

      const ext = path.extname(filename).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(ext)) return;

      const fullPath = path.join(watchfolderPath, filename);

      // Debounce: reset timer if the same file fires again before it settles
      const existing = pendingFiles.get(fullPath);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        pendingFiles.delete(fullPath);
        // Confirm the file exists — 'rename' fires on delete too
        if (fs.existsSync(fullPath)) {
          onFile(fullPath);
        }
      }, DEBOUNCE_MS);

      pendingFiles.set(fullPath, timer);
    },
  );

  const stop = () => {
    watcher.close();
    pendingFiles.forEach(clearTimeout);
    pendingFiles.clear();
    _stopFn = null;
  };

  _stopFn = stop;
  return stop;
}

/**
 * Stop the active watchfolder watcher (if any).
 */
export function stopWatchfolder(): void {
  _stopFn?.();
}

/**
 * Move a processed file to the processed/ subdir inside its watchfolder.
 * Falls back to copy + delete if fs.renameSync fails (cross-device move).
 * Adds a timestamp suffix to avoid overwriting existing files in processed/.
 */
export function moveToProcessed(filePath: string): void {
  const watchfolderPath = path.dirname(filePath);
  const processedDir = getProcessedDir(watchfolderPath);
  fs.mkdirSync(processedDir, { recursive: true });

  const basename = path.basename(filePath);
  let dest = path.join(processedDir, basename);

  // Avoid collisions — append epoch ms if destination already exists
  if (fs.existsSync(dest)) {
    const ext = path.extname(basename);
    const stem = path.basename(basename, ext);
    dest = path.join(processedDir, `${stem}_${Date.now()}${ext}`);
  }

  try {
    fs.renameSync(filePath, dest);
  } catch {
    // Cross-device move (e.g. tmpfs to ext4): copy first, then remove original
    fs.copyFileSync(filePath, dest);
    fs.unlinkSync(filePath);
  }
}
