# GREGLITE — SPRINT 2C EXECUTION BRIEF
## AEGIS Integration + Workload Signaling
**Instance:** Parallel Workstream C (run simultaneously with 2A, 2B, 2D)
**Created:** March 1, 2026
**Project:** D:\Projects\GregLite\
**Phase 1 baseline:** TypeScript 0 errors, 24/24 tests, KERNL SQLite live at .kernl/greglite.db

---

## YOUR ROLE

Bounded execution worker. You are wiring GregLite to AEGIS v1.0.0 so it can signal the Windows cognitive resource manager based on workload state. David is CEO. Execute as COO-level engineer. Zero debt, complete implementation.

---

## MANDATORY BOOTSTRAP

Load in order before writing any code:

1. `D:\Dev\CLAUDE_INSTRUCTIONS.md`
2. `D:\Dev\TECHNICAL_STANDARDS.md`
3. `D:\Projects\GregLite\DEV_PROTOCOLS.md`
4. `D:\Projects\GregLite\PROJECT_DNA.yaml`
5. `D:\Projects\GregLite\STATUS.md`
6. `D:\Projects\GregLite\BLUEPRINT_FINAL.md`
7. `D:\Projects\GregLite\SPRINT_2C_AEGIS.md` — your complete spec

Then read the AEGIS config to find its port:
```powershell
Get-ChildItem D:\Dev\aegis\ -Recurse | Where-Object { $_.Name -match "config|port|settings" }
```
Read whatever config file you find. The port is in there. Do not hardcode 3001 or any guess — read the actual value.

Then verify baseline:
```powershell
cd D:\Projects\GregLite\app
npx tsc --noEmit
pnpm test:run
```

---

## AUTHORITY PROTOCOL — STOP WHEN:

- Same fix applied 3+ times
- AEGIS API shape doesn't match what the sprint blueprint assumes — stop and report before building around it
- Operation estimated >8 minutes without a checkpoint
- TypeScript errors increase beyond baseline

Write a BLOCKED report with: what you were doing, what triggered the stop, what decision is needed.

---

## QUALITY GATES (ALL REQUIRED BEFORE COMMIT)

1. `npx tsc --noEmit` — zero new errors
2. `pnpm test:run` — zero failures
3. No mocks, stubs, or TODOs in production code
4. AEGIS being offline must never throw or block — test this explicitly
5. STATUS.md updated
6. Conventional commit format

---

## WHAT YOU ARE BUILDING

### Read AEGIS source first

Before writing a single line, read the AEGIS source at `D:\Dev\aegis\` to understand:
- What port it listens on
- What endpoints exist (especially `/signal` and `/health`)
- What the signal payload format is
- Whether it uses HTTP or something else

If AEGIS has a different API shape than what the sprint blueprint assumes, adapt to the real API — the blueprint is a spec for what you should produce on the GregLite side, but AEGIS is already built and its API is authoritative.

### New files

```
app/lib/aegis/
  index.ts        — public API: send(profile), override(profile), getLastProfile(), isOnline()
  client.ts       — HTTP client, fire-and-forget, silent failure on network error
  governor.ts     — determines correct profile from app state, anti-flap (min 5s between transitions)
  types.ts        — WorkloadProfile type, AEGISSignal interface
```

### WorkloadProfile type

```typescript
export type WorkloadProfile =
  | 'STARTUP'
  | 'DEEP_FOCUS'       // 0 workers, strategic thread active
  | 'CODE_GEN'         // code being generated in strategic thread
  | 'COWORK_BATCH'     // 1–2 workers running
  | 'RESEARCH'         // research-type sessions
  | 'BUILD'            // build/compile operations
  | 'PARALLEL_BUILD'   // 3+ workers running
  | 'COUNCIL'          // decision gate active
  | 'IDLE'             // no activity
  | 'SUSPEND';         // app closing
```

### Governor logic

```typescript
function determineProfile(state: AppState): WorkloadProfile {
  if (state.isClosing) return 'SUSPEND';
  if (state.activeWorkers === 0 && !state.hasActiveThread) return 'IDLE';
  if (state.activeWorkers === 0) return 'DEEP_FOCUS';
  if (state.activeWorkers <= 2) return 'COWORK_BATCH';
  return 'PARALLEL_BUILD';
}
```

Governor interval: every 5 seconds. Anti-flap: only send if profile changed AND at least 5000ms since last signal. This prevents rapid state changes from spamming AEGIS.

### HTTP client — critical rules

```typescript
async function sendSignal(profile: WorkloadProfile, sourceThread?: string): Promise<void> {
  try {
    await fetch(`http://localhost:${AEGIS_PORT}/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, sourceThread, timestamp: Date.now() }),
      signal: AbortSignal.timeout(2000),  // never hang
    });
  } catch {
    // AEGIS offline — log warning only, NEVER throw
    // GregLite must work regardless of AEGIS state
  }
}
```

AEGIS being down is a normal operating condition (user hasn't started it yet, it crashed, etc.). Silent failure is correct behavior. Log the offline state, don't surface it as an error to the user except for the status bar indicator.

### Health check on boot

```typescript
export async function checkAEGISHealth(): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${AEGIS_PORT}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
```

Call once on app boot. If false → show "AEGIS offline" in status bar. Continue normally.

### KERNL logging

Every signal sent (including overrides) → write to `aegis_signals` table:

```typescript
await kernl.db.run(
  `INSERT INTO aegis_signals (id, profile, source_thread, sent_at, is_override)
   VALUES (?, ?, ?, ?, ?)`,
  [nanoid(), profile, sourceThread ?? null, Date.now(), isOverride ? 1 : 0]
);
```

Verify `aegis_signals` table exists in `.kernl/greglite.db` before writing. If missing, add it to the KERNL schema migration.

### Status bar integration

Add AEGIS profile display to `app/components/ui/StatusBar.tsx` (or equivalent bottom bar). One-click opens override modal with all WorkloadProfile options listed. Override writes to KERNL with `is_override = 1` and sends signal immediately bypassing anti-flap.

Status bar format:
```
│  COST TODAY: $0.00  │  AEGIS: DEEP_FOCUS ▾  │
```

If AEGIS offline:
```
│  COST TODAY: $0.00  │  AEGIS: offline ⚠  │
```

### Boot sequence wiring

In the bootstrap module (`app/lib/bootstrap/index.ts`) — the `aegis-signal.ts` stub from Phase 1 should now be replaced with a real send. On boot:
1. Check AEGIS health
2. If online → send STARTUP signal
3. Start governor interval

On app close (window `beforeunload` or Tauri close event):
1. Send SUSPEND signal
2. Stop governor interval

---

## INTEGRATION WITH OTHER PARALLEL SPRINTS

- **2B (Context Panel):** 2B reads AEGIS profile from `aegis_signals` table for display. You write the signals. Coordinate on table schema if needed — check `STATUS.md`.
- **2A (Agent SDK):** When 2A ships, the `activeWorkers` count from their job store should feed into your governor's `AppState`. Wire that integration point when 2A is available — for now, mock `activeWorkers: 0` in governor state.

---

## CHECKPOINTING

Every 3 file writes:
1. `npx tsc --noEmit`
2. `git add && git commit -m "sprint-2c(wip): [what you just did]"`

---

## SESSION END

When all gates pass:

1. `npx tsc --noEmit` — zero errors
2. `pnpm test:run` — zero failures
3. Update `D:\Projects\GregLite\STATUS.md` — mark Sprint 2C complete
4. Final commit: `git commit -m "sprint-2c: AEGIS integration, workload signaling"`
5. `git push`
6. Write `SPRINT_2C_COMPLETE.md` to `D:\Projects\GregLite\` with: actual AEGIS port found, API shape confirmed, decisions made, anything deferred

---

## GATES CHECKLIST

- [ ] AEGIS port read from config (not hardcoded)
- [ ] STARTUP signal sent on app open — verify in KERNL `aegis_signals` table
- [ ] SUSPEND signal sent on app close
- [ ] DEEP_FOCUS sent when no workers active and thread is active
- [ ] IDLE sent when no activity
- [ ] Anti-flap works — rapid state changes don't create multiple rows per second
- [ ] Manual override in status bar — writes to KERNL with `is_override = 1`
- [ ] AEGIS offline shows "AEGIS offline" in status bar — does NOT crash app
- [ ] All signals have timestamps in KERNL table
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm test:run` clean
- [ ] Commit pushed

---

## ENVIRONMENT

- Project root: `D:\Projects\GregLite\`
- App dir: `D:\Projects\GregLite\app\`
- AEGIS source: `D:\Dev\aegis\`
- Package manager: pnpm
- KERNL DB: `D:\Projects\GregLite\app\.kernl\greglite.db`
- API key: already in `app\.env.local`
- Do NOT modify anything in `D:\Projects\Gregore\` or `D:\Dev\aegis\`
- Do NOT commit `.env.local`
