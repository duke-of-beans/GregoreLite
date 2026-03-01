# SPRINT 2C — AEGIS Integration
## GregLite Phase 2 | Parallel Workstream C
**Status:** READY TO QUEUE (after Phase 1 complete)  
**Depends on:** Phase 1 complete (Sprint 1E gates passed)  
**Parallel with:** 2A, 2B, 2D, 2E  
**Estimated sessions:** 2–3

---

## OBJECTIVE

Wire GregLite to AEGIS v1.0.0 (`D:\Dev\aegis\`). GregLite sends typed workload profile signals to AEGIS via local HTTP so AEGIS can optimize CPU, IO, memory, and power based on what GregLite is actually doing.

**Success criteria:**
- STARTUP signal sent on app boot
- DEEP_FOCUS signal sent when strategic thread active, no workers
- COWORK_BATCH signal sent when 1–2 worker sessions running
- PARALLEL_BUILD signal sent when 3+ workers running
- SUSPEND signal sent on app close
- Manual override in status bar works
- All signals logged to KERNL aegis_signals table
- Anti-flap enforced (min 5s between transitions)

---

## NEW FILES TO CREATE

```
app/lib/aegis/
  index.ts        — public API (send, override, getLastProfile)
  client.ts       — HTTP client for AEGIS local API
  governor.ts     — determines correct profile from app state, enforces anti-flap
  types.ts        — WorkloadProfile enum, AEGISSignal interface
```

---

## WORKLOAD PROFILES

```typescript
type WorkloadProfile =
  | 'STARTUP'
  | 'DEEP_FOCUS'      // 0 workers, strategic thread active
  | 'CODE_GEN'        // strategic thread generating code
  | 'COWORK_BATCH'    // 1-2 workers
  | 'RESEARCH'        // research-type sessions
  | 'BUILD'           // build/compile operations
  | 'PARALLEL_BUILD'  // 3+ workers
  | 'COUNCIL'         // decision gate active
  | 'IDLE'            // no activity
  | 'SUSPEND';        // app closing
```

---

## SIGNAL LOGIC

```typescript
function determineProfile(state: AppState): WorkloadProfile {
  if (state.isClosing) return 'SUSPEND';
  if (state.activeWorkers === 0 && !state.hasActiveThread) return 'IDLE';
  if (state.activeWorkers === 0) return 'DEEP_FOCUS';
  if (state.activeWorkers <= 2) return 'COWORK_BATCH';
  return 'PARALLEL_BUILD';
}
```

Governor runs every 5 seconds. If determined profile differs from last sent profile, and 5 seconds have elapsed since last signal, send new signal.

---

## HTTP CLIENT

AEGIS runs at `http://localhost:PORT` — check `D:\Dev\aegis\` for the actual port configuration. Build a simple fetch-based client:

```typescript
async function sendSignal(profile: WorkloadProfile, sourceThread?: string): Promise<void> {
  try {
    await fetch(`http://localhost:${AEGIS_PORT}/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, sourceThread, timestamp: Date.now() }),
    });
  } catch {
    // AEGIS not running — log warning, never throw
    // GregLite must work even if AEGIS is down
  }
}
```

AEGIS being down must never crash or block GregLite. All AEGIS calls are fire-and-forget with silent failure.

---

## STATUS BAR DISPLAY

Add AEGIS profile to bottom status bar. One-click → override modal with profile list. Override logged to KERNL `aegis_signals` table with `is_override = 1`.

```
│  COUNCIL: 0 pending │  COST TODAY: $0.42  │  AEGIS: DEEP_FOCUS ▾  │
```

---

## AEGIS STARTUP DETECTION

On boot, check if AEGIS is running before sending signal:
```typescript
async function checkAEGISHealth(): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${AEGIS_PORT}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}
```

If AEGIS not running, show small warning in status bar: "AEGIS offline". Never block boot.

---

## KERNL LOGGING

Every signal sent → write to `aegis_signals` table:
```typescript
await kernl.db.run(
  'INSERT INTO aegis_signals (id, profile, source_thread, sent_at, is_override) VALUES (?,?,?,?,?)',
  [nanoid(), profile, sourceThread ?? null, Date.now(), isOverride ? 1 : 0]
);
```

---

## READ AEGIS PORT

Before hardcoding, check `D:\Dev\aegis\` config files for the actual port AEGIS listens on. Sprint executor must read this first.

---

## GATES

- [ ] STARTUP signal sent on app open (verify in KERNL aegis_signals table)
- [ ] SUSPEND signal sent on app close
- [ ] DEEP_FOCUS sent when no workers active
- [ ] COWORK_BATCH sent when worker session spawned (test with 2A if complete, or mock)
- [ ] Anti-flap works (rapid state changes don't spam signals)
- [ ] Manual override persists in status bar
- [ ] AEGIS offline doesn't crash app
- [ ] All signals in KERNL table with timestamps
- [ ] pnpm type-check clean
- [ ] Commit: `sprint-2c: AEGIS integration, workload signaling`
