/**
 * Background Indexer — Public API
 *
 * Keeps the vector index current without blocking David's work.
 *
 * start()    — wire into bootstrap (non-blocking)
 * stop()     — clean shutdown
 * runOnce()  — single indexer pass (called by scheduler or out-of-schedule triggers)
 * getStatus() — live status for context panel
 *
 * Run logic:
 *   1. Read AEGIS throttle — SKIP if high-intensity profile active
 *   2. Apply budget: HALF = 250ms, FULL = 500ms
 *   3. Find unindexed content_chunks (vec_indexed = 0, up to 50 per run)
 *   4. Embed + upsert each chunk; mark vec_indexed = 1
 *   5. Yield between each embed (100ms delay per §5.2 blueprint)
 *   6. Rebuild hot cache if any chunks were indexed
 *
 * Migration: adds vec_indexed column to content_chunks on first start().
 *
 * @module lib/indexer
 */

import { getDatabase } from '@/lib/kernl/database';
import { upsertVector } from '@/lib/vector';
import { writeHotCache } from '@/lib/vector/hot-cache';
import { BudgetEnforcer } from './budget';
import { getThrottle } from './aegis-throttle';
import { startScheduler, stopScheduler } from './scheduler';
import type { IndexerRun, IndexerStatus } from './types';

export type { IndexerRun, IndexerStatus, ThrottleMode } from './types';
export { recordUserActivity } from './scheduler';

// ─── Module state ─────────────────────────────────────────────────────────────

let _isRunning = false;
let _lastRun: number | null = null;
let _lastRunChunksIndexed = 0;

// ─── Row shapes ───────────────────────────────────────────────────────────────

interface UnindexedRow {
  id: string;
  content: string;
}

interface HotCacheRow {
  id: string;
  embedding: Buffer;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Ensure content_chunks has the vec_indexed column.
 * SQLite ALTER TABLE ADD COLUMN is idempotent when wrapped in try/catch.
 */
function ensureVecIndexedColumn(): void {
  const db = getDatabase();
  try {
    db.exec('ALTER TABLE content_chunks ADD COLUMN vec_indexed INTEGER NOT NULL DEFAULT 0');
  } catch {
    // Column already exists — expected on subsequent boots
  }
}

/**
 * Embed a single piece of text using the embeddings module.
 * Returns the Float32Array, or null if embedding fails / returns empty.
 * Dynamic import breaks the circular dep with lib/embeddings.
 */
async function embedText(content: string): Promise<Float32Array | null> {
  try {
    const { embed } = await import('@/lib/embeddings');
    const records = await embed(content, 'conversation', 'indexer');
    return records[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

/**
 * Rebuild hot_cache.bin with the 1000 most recently created chunks
 * that have a vec_index entry. Called after each successful indexer run.
 */
async function rebuildHotCache(): Promise<void> {
  try {
    const db = getDatabase();
    const rows = db
      .prepare(
        `SELECT cc.id, vi.embedding
         FROM content_chunks cc
         JOIN vec_index vi ON cc.id = vi.chunk_id
         ORDER BY cc.created_at DESC
         LIMIT 1000`
      )
      .all() as HotCacheRow[];

    const records = rows
      .filter((r) => r.embedding)
      .map((r) => {
        const buf = Buffer.isBuffer(r.embedding) ? r.embedding : Buffer.from(r.embedding as ArrayBuffer);
        return {
          chunkId: r.id,
          embedding: new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4),
        };
      });

    await writeHotCache(records);
  } catch (err) {
    console.warn('[indexer] hot cache rebuild failed', { err });
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run a single indexer pass.
 *
 * Respects AEGIS throttle: SKIP returns immediately, HALF uses 250ms budget.
 * Processes up to 50 unindexed chunks per run, yielding 100ms between embeds.
 * Rebuilds hot cache if any chunks were indexed.
 */
export async function runOnce(): Promise<IndexerRun> {
  if (_isRunning) {
    return { status: 'skipped', reason: 'already_running', chunksIndexed: 0, elapsedMs: 0 };
  }

  const throttle = getThrottle();
  if (throttle === 'SKIP') {
    return { status: 'skipped', reason: 'aegis', chunksIndexed: 0, elapsedMs: 0 };
  }

  _isRunning = true;

  const budgetMs = throttle === 'HALF' ? 250 : 500;
  const budget = new BudgetEnforcer(budgetMs);
  budget.start();

  try {
    const db = getDatabase();

    const unindexed = db
      .prepare(
        `SELECT id, content
         FROM content_chunks
         WHERE vec_indexed = 0
         ORDER BY created_at DESC
         LIMIT 50`
      )
      .all() as UnindexedRow[];

    let chunksIndexed = 0;

    for (const chunk of unindexed) {
      if (budget.isExceeded()) break;

      const embedding = await embedText(chunk.content);
      if (embedding !== null) {
        await upsertVector(chunk.id, embedding);
        db.prepare('UPDATE content_chunks SET vec_indexed = 1 WHERE id = ?').run(chunk.id);
        chunksIndexed++;
      }

      // 100ms yield between embeds — prevents CPU monopolisation (§5.2)
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }

    if (chunksIndexed > 0) {
      await rebuildHotCache();
    }

    _lastRun = Date.now();
    _lastRunChunksIndexed = chunksIndexed;

    return { status: 'complete', chunksIndexed, elapsedMs: budget.elapsed() };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: 'error', reason: msg, chunksIndexed: 0, elapsedMs: budget.elapsed() };
  } finally {
    _isRunning = false;
  }
}

/**
 * Start the background indexer.
 * Wires the 30-minute cadence scheduler.
 * Runs migration to add vec_indexed column if needed.
 * Call this from bootstrap/index.ts (non-blocking).
 */
export function start(): void {
  ensureVecIndexedColumn();
  startScheduler(async () => {
    const result = await runOnce();
    console.log(`[indexer] run complete: ${JSON.stringify(result)}`);
  });
  console.log('[indexer] background indexer started');
}

/** Stop the background indexer. Safe to call multiple times. */
export function stop(): void {
  stopScheduler();
  console.log('[indexer] background indexer stopped');
}

/**
 * Current indexer status — consumed by context panel KERNLStatus component.
 */
export function getStatus(): IndexerStatus {
  const db = getDatabase();
  let unindexedCount = 0;

  try {
    const row = db
      .prepare('SELECT COUNT(*) as count FROM content_chunks WHERE vec_indexed = 0')
      .get() as { count: number } | undefined;
    unindexedCount = row?.count ?? 0;
  } catch {
    // vec_indexed column not yet created — first boot before start()
    unindexedCount = 0;
  }

  return {
    lastRun: _lastRun,
    lastRunChunksIndexed: _lastRunChunksIndexed,
    unindexedCount,
    isRunning: _isRunning,
    currentThrottle: getThrottle(),
  };
}
