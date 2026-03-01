/**
 * seed-vectors.ts — Seed vec_index with synthetic chunks for dev benchmarking.
 *
 * Run with: npx tsx scripts/seed-vectors.ts
 *
 * Generates N fake content_chunks + vec_index entries using deterministic
 * Float32Array embeddings (no real model download required for seeding).
 * Measures k=10 cosine search latency at 10 / 100 / 500 chunk counts.
 *
 * Quality gate (§5.2 blueprint): k=10 query < 200ms on 500+ indexed chunks.
 *
 * IMPORTANT: Requires the runtime DB (better-sqlite3 + sqlite-vec DLL).
 * Do NOT run in CI — use the mocked test suite for automated testing.
 */

import { getDatabase } from '../lib/kernl/database';
import { upsertVector, searchSimilar } from '../lib/vector';

const DIMENSION = 384;
const TOTAL_CHUNKS = 500;

/** Deterministic 384-dim Float32Array seeded from chunk index. */
function makeFakeEmbedding(seed: number): Float32Array {
  const data = new Float32Array(DIMENSION);
  for (let i = 0; i < DIMENSION; i++) {
    data[i] = (Math.sin(seed * 1000 + i) + 1) / 2; // values in [0, 1]
  }
  // Normalize to unit vector (required for cosine distance to be well-defined)
  const norm = Math.sqrt(data.reduce((sum, v) => sum + v * v, 0));
  for (let i = 0; i < DIMENSION; i++) {
    data[i] = (data[i] ?? 0) / norm;
  }
  return data;
}

/** Insert a fake content_chunks row (text + metadata) via raw SQL. */
function seedContentChunk(db: ReturnType<typeof getDatabase>, id: string, i: number): void {
  const now = Date.now();
  db.prepare(`
    INSERT OR REPLACE INTO content_chunks
      (id, source_type, source_id, chunk_index, content, metadata, model_id, created_at, indexed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    'conversation',
    `seed-thread-${Math.floor(i / 10)}`,
    i % 10,
    `Synthetic seed chunk ${i}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. `.repeat(4).trim(),
    JSON.stringify({ embedding_dim: DIMENSION, seed: true }),
    'Xenova/bge-small-en-v1.5',
    now,
    now
  );
}

async function benchmark(label: string, fn: () => Promise<unknown>): Promise<number> {
  const t0 = performance.now();
  await fn();
  const ms = performance.now() - t0;
  console.log(`  [bench] ${label}: ${ms.toFixed(1)}ms`);
  return ms;
}

async function main() {
  console.log(`[seed-vectors] Seeding ${TOTAL_CHUNKS} synthetic chunks into KERNL...`);

  const db = getDatabase();

  // Generate all fake chunk IDs and embeddings
  const chunks: Array<{ id: string; embedding: Float32Array }> = [];
  for (let i = 0; i < TOTAL_CHUNKS; i++) {
    chunks.push({ id: `seed-chunk-${i}`, embedding: makeFakeEmbedding(i) });
  }

  // Insert into content_chunks + vec_index at checkpoints: 10, 100, 500
  const checkpoints = [10, 100, 500];
  let nextCheckpoint = checkpoints.shift();

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    seedContentChunk(db, chunk.id, i);
    await upsertVector(chunk.id, chunk.embedding);

    if (nextCheckpoint !== undefined && i + 1 === nextCheckpoint) {
      console.log(`\n[seed-vectors] Indexed ${i + 1} chunks — running k=10 benchmark:`);
      const queryVec = makeFakeEmbedding(999); // unseen query vector
      const ms = await benchmark(`k=10 search at ${i + 1} chunks`, () =>
        searchSimilar(queryVec, 10)
      );
      const gate = 200;
      const status = ms < gate ? '✅ PASS' : '❌ FAIL';
      console.log(`  ${status} (gate: <${gate}ms, actual: ${ms.toFixed(1)}ms)`);
      nextCheckpoint = checkpoints.shift();
    }
  }

  console.log(`\n[seed-vectors] Done. ${TOTAL_CHUNKS} chunks indexed.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed-vectors] Failed:', err);
  process.exit(1);
});
