/**
 * seed-manifests.ts
 *
 * Seeds the KERNL manifests table with a diamond dependency pattern:
 *
 *       A
 *      / \
 *     B   C
 *      \ /
 *       D
 *
 * A has no dependencies. B and C depend on A. D depends on B and C.
 *
 * Run: npx ts-node --project tsconfig.json scripts/seed-manifests.ts
 *
 * Sprint 2E — War Room layout testing
 */

import { getDatabase } from '../lib/kernl/database';

interface SeedManifest {
  id: string;
  title: string;
  status: string;
  task_type: string;
  dependencies: string; // JSON
}

const SEED_THREAD_ID = 'seed-thread-001';

function ensureSeedThread(db: ReturnType<typeof getDatabase>): void {
  const existing = db
    .prepare('SELECT id FROM threads WHERE id = ?')
    .get(SEED_THREAD_ID);

  if (!existing) {
    db.prepare(
      `INSERT INTO threads (id, title, created_at, updated_at)
       VALUES (?, 'Seed Thread', unixepoch('now','subsec')*1000, unixepoch('now','subsec')*1000)`,
    ).run(SEED_THREAD_ID);
    console.log('[seed] Created seed thread:', SEED_THREAD_ID);
  }
}

const MANIFESTS: SeedManifest[] = [
  {
    id: 'manifest-seed-a',
    title: 'Sprint 2A — Agent SDK',
    status: 'completed',
    task_type: 'code',
    dependencies: '[]',
  },
  {
    id: 'manifest-seed-b',
    title: 'Sprint 2B — Context Panel',
    status: 'completed',
    task_type: 'code',
    dependencies: '["manifest-seed-a"]',
  },
  {
    id: 'manifest-seed-c',
    title: 'Sprint 2C — AEGIS',
    status: 'running',
    task_type: 'code',
    dependencies: '["manifest-seed-a"]',
  },
  {
    id: 'manifest-seed-d',
    title: 'Sprint 2D — Artifacts',
    status: 'pending',
    task_type: 'code',
    dependencies: '["manifest-seed-b", "manifest-seed-c"]',
  },
];

function seed(): void {
  const db = getDatabase();

  ensureSeedThread(db);

  let inserted = 0;
  let skipped = 0;

  for (const m of MANIFESTS) {
    const existing = db
      .prepare('SELECT id FROM manifests WHERE id = ?')
      .get(m.id);

    if (existing) {
      console.log('[seed] Skipping (already exists):', m.id);
      skipped++;
      continue;
    }

    db.prepare(
      `INSERT INTO manifests
         (id, version, spawned_by_thread, strategic_thread_id,
          created_at, status, task_type, title, dependencies)
       VALUES (?, '1.0', ?, ?, datetime('now'), ?, ?, ?, ?)`,
    ).run(
      m.id,
      SEED_THREAD_ID,
      SEED_THREAD_ID,
      m.status,
      m.task_type,
      m.title,
      m.dependencies,
    );

    console.log('[seed] Inserted:', m.id, `(${m.status})`);
    inserted++;
  }

  console.log(`\n[seed] Done — ${inserted} inserted, ${skipped} skipped`);
  console.log('[seed] Diamond pattern: A → B, A → C, B+C → D');
}

seed();
