/**
 * Vector Store — sqlite-vec Extension Setup
 *
 * Loads the sqlite-vec extension into the KERNL database and ensures
 * the vec_index virtual table exists. Called once (singleton guard)
 * before any vector operation.
 *
 * vec_index schema:
 *   chunk_id TEXT PRIMARY KEY   — join key to content_chunks.id (Sprint 3A)
 *   embedding FLOAT[384]        — 384-dim bge-small-en-v1.5 vectors
 *   distance_metric=cosine      — cosine distance (lower = more similar)
 *
 * Cannot be in schema.sql — vec0 extension must be loaded first.
 * Called lazily by getDb() in index.ts before every operation.
 *
 * Windows binary: sqlite-vec npm package bundles vec0.dll for win-x64.
 * load(db) calls db.loadExtension(getLoadablePath()) internally.
 */

import { load } from 'sqlite-vec';
import type Database from 'better-sqlite3';

let _vecInitialized = false;

export function ensureVecIndex(db: Database.Database): void {
  if (_vecInitialized) return;

  // Load the sqlite-vec extension (prebuilt Windows DLL via npm package)
  load(db);

  // Create the virtual table — requires the extension to be loaded first
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_index USING vec0(
      chunk_id TEXT PRIMARY KEY,
      embedding FLOAT[384] distance_metric=cosine
    );
  `);

  _vecInitialized = true;
}

/**
 * Reset initialization state — exposed for test isolation only.
 * Do NOT call in production code.
 */
export function _resetVecState(): void {
  _vecInitialized = false;
}
