# GREGLITE — SPRINT 3D EXECUTION BRIEF
## Background Indexer + AEGIS Throttling
**Instance:** Sequential after 3C
**Created:** March 1, 2026
**Project:** D:\Projects\GregLite\
**Depends on:** Sprint 3C complete (three-tier warming live)

---

## YOUR ROLE

Bounded execution worker. You are building the background indexer — the process that keeps the vector index current without blocking David's work. It runs on a cadence, respects AEGIS workload signals, and never steals foreground resources. David is CEO. Execute as COO-level engineer. Zero debt, complete implementation.

---

## MANDATORY BOOTSTRAP

Load in order:

1. `D:\Dev\CLAUDE_INSTRUCTIONS.md`
2. `D:\Dev\TECHNICAL_STANDARDS.md`
3. `D:\Projects\GregLite\DEV_PROTOCOLS.md`
4. `D:\Projects\GregLite\STATUS.md`
5. `D:\Projects\GregLite\BLUEPRINT_FINAL.md` — §5.6 (Background Indexer) specifically
6. `D:\Projects\GregLite\SPRINT_3C_COMPLETE.md` — confirm 3C done

Baseline check:
```powershell
cd D:\Projects\GregLite\app
npx tsc --noEmit
pnpm test:run
```

---

## AUTHORITY PROTOCOL — STOP WHEN:

- CPU budget enforcement approach is unclear — clarify before building
- AEGIS signal reading from DB vs live state is ambiguous — resolve before building the throttle
- Same fix 3+ times

---

## QUALITY GATES

1. `npx tsc --noEmit` — zero new errors
2. `pnpm test:run` — zero failures
3. Indexer never runs during `BUILD_SPRINT` or `COUNCIL` AEGIS profiles
4. Indexer runs at half speed during `DEEP_FOCUS`
5. 500ms CPU budget enforced per run (yields if exceeded)
6. STATUS.md updated

---

## WHAT YOU ARE BUILDING

### New files

```
app/lib/indexer/
  index.ts          — public API: start(), stop(), runOnce(), getStatus()
  scheduler.ts      — cadence management, out-of-schedule triggers
  budget.ts         — 500ms CPU budget enforcer
  aegis-throttle.ts — reads last AEGIS profile, determines indexer behavior
  types.ts          — IndexerStatus, IndexerRun interfaces
```

### Cadence — from §5.6

- Every 30 minutes, only if user has been idle for 5+ minutes
- Out-of-schedule triggers: after session end, after large job completion
- Budget: 500ms CPU per run — yields if exceeded, resumes next cadence tick

```typescript
// scheduler.ts
const CADENCE_MS = 30 * 60 * 1000;   // 30 minutes
const IDLE_REQUIRED_MS = 5 * 60 * 1000; // 5 minutes idle

let lastUserActivity = Date.now();
let schedulerInterval: NodeJS.Timeout | null = null;

export function recordUserActivity(): void {
  lastUserActivity = Date.now();
}

export function isUserIdle(): boolean {
  return Date.now() - lastUserActivity > IDLE_REQUIRED_MS;
}

export function startScheduler(runFn: () => Promise<void>): void {
  schedulerInterval = setInterval(async () => {
    if (!isUserIdle()) return;
    const throttle = await getThrottle();
    if (throttle === 'SKIP') return;
    await runFn();
  }, CADENCE_MS);
}
```

Wire `recordUserActivity()` into the chat route — call it on every user message.

### AEGIS throttle — from §5.6

```typescript
// aegis-throttle.ts
type ThrottleMode = 'FULL' | 'HALF' | 'SKIP';

export async function getThrottle(): Promise<ThrottleMode> {
  // Read last AEGIS signal from KERNL
  const last = kernl.db.prepare(
    'SELECT profile FROM aegis_signals ORDER BY sent_at DESC LIMIT 1'
  ).get() as { profile: string } | undefined;

  const profile = last?.profile ?? 'IDLE';

  if (profile === 'BUILD_SPRINT' || profile === 'COUNCIL' || profile === 'PARALLEL_BUILD') {
    return 'SKIP';
  }
  if (profile === 'DEEP_FOCUS' || profile === 'CODE_GEN') {
    return 'HALF';
  }
  return 'FULL'; // IDLE, STARTUP, COWORK_BATCH, RESEARCH
}
```

### CPU budget enforcer

500ms wall-clock budget per run. Not actual CPU measurement — just elapsed time. If elapsed exceeds budget, stop processing the current batch and record how far we got. Next run picks up from that offset.

```typescript
// budget.ts
export class BudgetEnforcer {
  private startTime: number = 0;
  private budgetMs: number;

  constructor(budgetMs: number = 500) {
    this.budgetMs = budgetMs;
  }

  start(): void { this.startTime = Date.now(); }

  isExceeded(): boolean { return Date.now() - this.startTime > this.budgetMs; }

  elapsed(): number { return Date.now() - this.startTime; }
}
```

### Main indexer run

```typescript
// index.ts
export async function runOnce(): Promise<IndexerRun> {
  const throttle = await getThrottle();
  if (throttle === 'SKIP') return { status: 'skipped', reason: 'aegis', chunksIndexed: 0 };

  const budget = new BudgetEnforcer(throttle === 'HALF' ? 250 : 500);
  budget.start();

  // Find unindexed content_chunks (no matching vec_index entry)
  const unindexed = kernl.db.prepare(`
    SELECT cc.id, cc.content, cc.source_type, cc.source_id
    FROM content_chunks cc
    LEFT JOIN vec_index vi ON cc.id = vi.chunk_id
    WHERE vi.chunk_id IS NULL
    ORDER BY cc.created_at DESC
    LIMIT 50
  `).all() as any[];

  let chunksIndexed = 0;
  for (const chunk of unindexed) {
    if (budget.isExceeded()) break;

    const embedding = await embedText(chunk.content);
    await upsertVector(chunk.id, embedding);
    chunksIndexed++;

    await new Promise(r => setTimeout(r, 100)); // 100ms delay between embeds per §5.2
  }

  // Rebuild hot cache if we indexed anything
  if (chunksIndexed > 0) {
    await rebuildHotCache();
  }

  return { status: 'complete', chunksIndexed, elapsedMs: budget.elapsed() };
}
```

### Out-of-schedule triggers

Wire these two trigger points:

1. **After session end** — in continuity checkpoint or session manager, after final checkpoint is written:
   ```typescript
   setImmediate(() => runOnce().catch(logger.warn));
   ```

2. **After Agent SDK job completion** — in job-tracker.ts (Sprint 2A), after writing `COMPLETED` status:
   ```typescript
   setImmediate(() => runOnce().catch(logger.warn));
   ```

### Status API

Expose indexer status to the context panel (Sprint 2B's `KERNLStatus` component reads this):

```typescript
export interface IndexerStatus {
  lastRun: number | null;
  lastRunChunksIndexed: number;
  unindexedCount: number;
  isRunning: boolean;
  currentThrottle: ThrottleMode;
}

export function getStatus(): IndexerStatus
```

The context panel's "● indexed / ○ indexing" display should use `isRunning` and `unindexedCount === 0`.

---

## CHECKPOINTING

Every 3 file writes: `npx tsc --noEmit` + `git add && git commit -m "sprint-3d(wip): [description]"`

---

## SESSION END

1. Zero errors, zero failures
2. Update STATUS.md — Sprint 3D complete
3. `git commit -m "sprint-3d: background indexer, AEGIS throttling"`
4. `git push`
5. Write `SPRINT_3D_COMPLETE.md` — indexer run times observed, AEGIS throttle behavior confirmed, any budget tuning done

---

## GATES CHECKLIST

- [ ] Indexer starts on app boot (non-blocking)
- [ ] 30-minute cadence fires (verify via log)
- [ ] Indexer skips if user active in last 5 minutes
- [ ] `SKIP` throttle when AEGIS profile is PARALLEL_BUILD or COUNCIL
- [ ] `HALF` speed (250ms budget) when DEEP_FOCUS
- [ ] 500ms budget enforced — indexer stops mid-batch if exceeded
- [ ] Out-of-schedule trigger fires after session end
- [ ] Hot cache rebuilt after each successful indexer run
- [ ] `getStatus()` returns correct `unindexedCount` and `isRunning`
- [ ] Context panel KERNLStatus reflects live indexer state
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm test:run` clean
- [ ] Commit pushed
