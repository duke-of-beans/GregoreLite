# GREGLITE — SPRINT 3D EXECUTION BRIEF
## Background Indexer + AEGIS Throttling
**Instance:** Phase 3, Workstream D
**Created:** March 1, 2026
**Project:** D:\Projects\GregLite\
**Prerequisite:** Sprint 3C complete (three-tier cache live)

---

## YOUR ROLE

Bounded execution worker. You are building the background indexer — a scheduled job that keeps the vector index fresh without burning CPU during active sessions. AEGIS governs its speed. David is CEO. Zero debt.

---

## MANDATORY BOOTSTRAP

1. `D:\Dev\CLAUDE_INSTRUCTIONS.md`
2. `D:\Dev\TECHNICAL_STANDARDS.md`
3. `D:\Projects\GregLite\DEV_PROTOCOLS.md`
4. `D:\Projects\GregLite\PROJECT_DNA.yaml`
5. `D:\Projects\GregLite\STATUS.md`
6. `D:\Projects\GregLite\BLUEPRINT_FINAL.md` — §5.6 (Background Indexer) specifically
7. `D:\Projects\GregLite\SPRINT_3C_COMPLETE.md`

Verify baseline before touching anything.

---

## AUTHORITY PROTOCOL — STOP WHEN:

- Background indexer causes UI jank or chat latency — stop and report
- Memory usage grows unbounded during indexing run — stop and report
- TypeScript errors increase beyond baseline

---

## QUALITY GATES

1. `npx tsc --noEmit` — zero new errors
2. `pnpm test:run` — zero failures
3. Indexer run completes in <500ms CPU wall time per cadence
4. Indexer yields when AEGIS signals COUNCIL or BUILD_SPRINT
5. STATUS.md updated

---

## WHAT YOU ARE BUILDING

### New files

```
app/lib/cross-context/
  background-indexer.ts  — scheduler, run loop, AEGIS integration
  indexer-state.ts       — tracks last run, queue of unindexed chunks
```

### Indexer behavior (from BLUEPRINT §5.6)

- **Cadence:** Every 30 minutes, only if idle for 5+ minutes
- **Out-of-schedule triggers:** After session end, after large job completion
- **CPU budget:** 500ms per run — yields if exceeded
- **AEGIS rules:**
  - `BUILD_SPRINT` or `COUNCIL` → suspend entirely
  - `DEEP_FOCUS` → half speed (add 100ms delay between chunks)
  - `IDLE` → full speed

### Implementation

```typescript
// app/lib/cross-context/background-indexer.ts

import { getLastAEGISProfile } from '../aegis';
import { embedText } from './embedder';
import { insertEmbedding } from './vector-store';
import { chunkText } from './chunker';

const CADENCE_MS = 30 * 60 * 1000;       // 30 minutes
const IDLE_REQUIRED_MS = 5 * 60 * 1000;  // 5 minutes idle
const CPU_BUDGET_MS = 500;

let lastUserActivity = Date.now();
let indexerInterval: ReturnType<typeof setInterval> | null = null;

export function recordUserActivity(): void {
  lastUserActivity = Date.now();
}

export function startBackgroundIndexer(): void {
  indexerInterval = setInterval(async () => {
    const idleMs = Date.now() - lastUserActivity;
    if (idleMs < IDLE_REQUIRED_MS) return;

    const aegisProfile = getLastAEGISProfile();
    if (aegisProfile === 'COUNCIL' || aegisProfile === 'PARALLEL_BUILD') {
      return; // suspended
    }

    await runIndexerPass(aegisProfile);
  }, CADENCE_MS);
}

export function stopBackgroundIndexer(): void {
  if (indexerInterval) clearInterval(indexerInterval);
}

async function runIndexerPass(aegisProfile: string): Promise<void> {
  const halfSpeed = aegisProfile === 'DEEP_FOCUS' || aegisProfile === 'COWORK_BATCH';
  const startMs = Date.now();

  // Find unindexed chunks
  const unindexed = db.prepare(`
    SELECT c.id, c.content, c.source_type
    FROM content_chunks c
    WHERE c.indexed_at IS NULL
    LIMIT 50
  `).all() as any[];

  for (const chunk of unindexed) {
    // Yield if over CPU budget
    if (Date.now() - startMs > CPU_BUDGET_MS) break;

    try {
      const embedding = await embedText(chunk.content);
      insertEmbedding(chunk.id, embedding);
      db.prepare(`UPDATE content_chunks SET indexed_at = ? WHERE id = ?`)
        .run(Date.now(), chunk.id);

      if (halfSpeed) {
        await new Promise(r => setTimeout(r, 100));
      }
    } catch (err) {
      console.warn('[indexer] chunk failed:', chunk.id, err);
    }
  }

  // Refresh hot cache after indexing pass
  const recent = db.prepare(`
    SELECT c.id, v.embedding FROM content_chunks c
    JOIN vec_index v ON v.chunk_id = c.id
    ORDER BY c.indexed_at DESC LIMIT 2000
  `).all() as any[];

  writeHotCache(recent.map(r => ({
    chunkId: r.id,
    embedding: new Float32Array(r.embedding.buffer)
  })));
}
```

### Out-of-schedule triggers

Export a `triggerIndexerRun()` function that runs a pass immediately regardless of cadence:

```typescript
export async function triggerIndexerRun(): Promise<void> {
  await runIndexerPass(getLastAEGISProfile());
}
```

Wire this into:
1. Session end sequence in `app/lib/kernl/session-manager.ts`
2. Agent SDK job completion in `app/lib/agent-sdk/job-tracker.ts`

### Activity tracking

Wire `recordUserActivity()` into the chat input handler in `app/components/chat/InputField.tsx` — call it on every keystroke. This is the idle detection signal.

### AEGIS integration

Import the AEGIS module built in Sprint 2C. The `getLastAEGISProfile()` function should already exist — read Sprint 2C's completion report to find the exact export name.

---

## SESSION END

1. `npx tsc --noEmit` — zero errors
2. `pnpm test:run` — zero failures
3. Manually verify: let the app idle for 5 minutes (or reduce the cadence to 1 minute for testing), check that `indexed_at` gets populated on previously null chunks
4. Update STATUS.md
5. Commit: `sprint-3d: background indexer, AEGIS throttling`
6. Push
7. Write `SPRINT_3D_COMPLETE.md`

---

## GATES

- [ ] Indexer starts on app boot
- [ ] Indexer skips run if user active in last 5 minutes
- [ ] Indexer suspends when AEGIS = COUNCIL or PARALLEL_BUILD
- [ ] Indexer runs at half speed when AEGIS = DEEP_FOCUS
- [ ] CPU budget enforced — run stops at 500ms
- [ ] `indexed_at` populated on chunks after indexer runs
- [ ] Hot cache refreshed after each indexer pass
- [ ] `triggerIndexerRun()` fires after session end
- [ ] `triggerIndexerRun()` fires after agent job completion
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm test:run` clean
- [ ] Commit pushed
