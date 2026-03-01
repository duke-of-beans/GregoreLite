/**
 * seed-kernl.ts — Seed KERNL with local test data for Sprint 2B dev.
 *
 * Run with: npx tsx scripts/seed-kernl.ts
 *
 * Seeds: 1 active project (GregLite), 1 thread, 3 decisions.
 * Safe to re-run — uses upsertProject (ON CONFLICT DO UPDATE).
 * Does NOT hardcode data into production components.
 */

import { upsertProject, createThread, logDecision } from '../lib/kernl';

async function main() {
  console.log('[seed] Seeding KERNL...');

  // Upsert the GregLite project as active
  const project = upsertProject(
    'greglite',
    'GregLite',
    'D:\\Projects\\GregLite'
  );
  console.log(`[seed] Project: ${project.name} (${project.id})`);

  // Create a thread to attach decisions to
  const thread = createThread({
    title: 'Sprint 2B dev seed',
    project_id: project.id,
  });
  console.log(`[seed] Thread: ${thread.id}`);

  // Log 3 representative decisions
  const d1 = logDecision({
    thread_id: thread.id,
    category: 'technical',
    title: 'Use better-sqlite3 for KERNL persistence',
    rationale: 'WAL mode, synchronous, no Redis dependency',
    alternatives: ['PostgreSQL', 'LevelDB'],
    impact: 'high',
  });
  console.log(`[seed] Decision 1: ${d1.title}`);

  const d2 = logDecision({
    thread_id: thread.id,
    category: 'architectural',
    title: 'Bootstrap loads dev protocols from D:\\Dev\\',
    rationale: 'Resolves D:\\Dev\\ dependency gap — protocols injected as first-class context',
    alternatives: ['Inline in system prompt', 'Skip dev protocols'],
    impact: 'high',
  });
  console.log(`[seed] Decision 2: ${d2.title}`);

  const d3 = logDecision({
    thread_id: thread.id,
    category: 'architectural',
    title: 'Single-model only (Anthropic/Sonnet)',
    rationale: 'GregLite identity — not a mini-Gregore. Consensus engine is Gregore (full) feature.',
    alternatives: ['Multi-model from day one', 'OpenAI fallback'],
    impact: 'high',
  });
  console.log(`[seed] Decision 3: ${d3.title}`);

  console.log('[seed] Done. KERNL seeded with 1 project, 1 thread, 3 decisions.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
