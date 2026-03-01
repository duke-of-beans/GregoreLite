/**
 * benchmark-3h.ts — Sprint 3H performance benchmarks.
 *
 * Run with: npx tsx scripts/benchmark-3h.ts
 *
 * Seeds vec_index with 1000 synthetic chunks, then measures:
 *   1. k=10 cosine similarity query at 100 / 500 / 1000 chunks
 *   2. Hot cache (Tier 1) k=10 brute-force search (1000 records)
 *
 * Quality gates (BLUEPRINT_FINAL §5.2):
 *   - k=10 query < 200ms at 1000+ chunks
 *   - Hot cache k=10 < 5ms
 */

import { getDatabase } from '../lib/kernl/database';
import { upsertVector, searchSimilar } from '../lib/vector';
import { writeHotCache, readHotCache, searchHotCache } from '../lib/vector/hot-cache';

const DIMENSION = 384;
const TOTAL_CHUNKS = 1000;

function makeFakeEmbedding(seed: number): Float32Array {
  const data = new Float32Array(DIMENSION);
  for (let i = 0; i < DIMENSION; i++) {
    data[i] = (Math.sin(seed * 1000 + i) + 1) / 2;
  }
  const norm = Math.sqrt(data.reduce((sum, v) => sum + v * v, 0));
  for (let i = 0; i < DIMENSION; i++) {
    data[i] = (data[i] ?? 0) / norm;
  }
  return data;
}

function seedContentChunk(db: ReturnType<typeof getDatabase>, id: string, i: number): void {
  const now = Date.now();
  db.prepare(`
    INSERT OR REPLACE INTO content_chunks
      (id, source_type, source_id, chunk_index, content, metadata, model_id, created_at, indexed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    'conversation',
    `bench-thread-${Math.floor(i / 10)}`,
    i % 10,
    `Benchmark chunk ${i}: cross-context engine with vector search, embedding pipeline, proactive surfacing. `.repeat(3).trim(),
    JSON.stringify({ embedding_dim: DIMENSION, bench: true }),
    'Xenova/bge-small-en-v1.5',
    now,
    now
  );
}

async function bench(label: string, fn: () => unknown): Promise<number> {
  const t0 = performance.now();
  await fn();
  const ms = performance.now() - t0;
  console.log(`  [bench] ${label}: ${ms.toFixed(2)}ms`);
  return ms;
}

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('SPRINT 3H — PERFORMANCE BENCHMARKS');
  console.log(`${'='.repeat(60)}\n`);

  const db = getDatabase();
  const queryVec = makeFakeEmbedding(9999); // unseen query vector

  // ── 1. Seed vec_index with 1000 chunks ────────────────────────────────────
  console.log(`[1/3] Seeding ${TOTAL_CHUNKS} synthetic chunks into vec_index...`);

  const chunks: Array<{ id: string; embedding: Float32Array }> = [];
  for (let i = 0; i < TOTAL_CHUNKS; i++) {
    chunks.push({ id: `bench-chunk-${i}`, embedding: makeFakeEmbedding(i) });
  }

  const checkpointResults: Record<number, number> = {};
  const checkpoints = [100, 500, 1000];
  let cpIdx = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    seedContentChunk(db, chunk.id, i);
    await upsertVector(chunk.id, chunk.embedding);

    const cp = checkpoints[cpIdx];
    if (cp !== undefined && i + 1 === cp) {
      console.log(`\n  Checkpoint: ${cp} chunks indexed`);
      const ms = await bench(`k=10 cosine search @ ${cp} chunks`, () =>
        searchSimilar(queryVec, 10)
      );
      checkpointResults[cp] = ms;
      const gate = 200;
      console.log(`  ${ms < gate ? '✅ PASS' : '❌ FAIL'} (gate: <${gate}ms)`);
      cpIdx++;
    }
  }

  // ── 2. Hot cache (Tier 1) benchmark ──────────────────────────────────────
  console.log(`\n[2/3] Hot cache (Tier 1) benchmark...`);
  // Seed hot cache with 1000 synthetic records
  const hotRecords = chunks.map(c => ({ chunkId: c.id, embedding: c.embedding }));
  await writeHotCache(hotRecords);
  await readHotCache(); // populates in-memory index

  const hotMs = await bench('hot cache k=10 brute-force @ 1000 records', () =>
    searchHotCache(queryVec, 10)
  );
  console.log(`  ${hotMs < 5 ? '✅ PASS' : '❌ FAIL'} (gate: <5ms)`);

  // ── 3. Summary ─────────────────────────────────────────────────────────────
  const q100  = checkpointResults[100]  ?? 0;
  const q500  = checkpointResults[500]  ?? 0;
  const q1000 = checkpointResults[1000] ?? 0;

  console.log(`\n[3/3] Results summary:`);
  console.log(`${'─'.repeat(50)}`);
  console.log(`  k=10 query @ 100 chunks:   ${q100.toFixed(2)}ms`);
  console.log(`  k=10 query @ 500 chunks:   ${q500.toFixed(2)}ms`);
  console.log(`  k=10 query @ 1000 chunks:  ${q1000.toFixed(2)}ms   (gate: <200ms)`);
  console.log(`  Hot cache k=10 @ 1000:     ${hotMs.toFixed(2)}ms    (gate: <5ms)`);
  console.log(`${'─'.repeat(50)}`);
  console.log(`  k=10 @ 1000:  ${q1000 < 200 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Hot cache:    ${hotMs < 5   ? '✅ PASS' : '❌ FAIL'}`);
  console.log('\n[done]\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('[benchmark-3h] Failed:', err);
  process.exit(1);
});
