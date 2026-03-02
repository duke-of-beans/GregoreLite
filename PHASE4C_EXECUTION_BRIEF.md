# GREGLITE — SPRINT 4C EXECUTION BRIEF
## Decision Gate — Integration + Phase 4 Hardening
**Instance:** Sequential after 4B (final Phase 4 sprint)
**Created:** March 1, 2026
**Project:** D:\Projects\GregLite\
**Depends on:** Sprint 4B complete (full gate live end-to-end)

---

## YOUR ROLE

Bounded execution worker. You are certifying Phase 4 complete — integration testing, false positive tuning, performance measurement, and closing out the Decision Gate as a production feature. David is CEO. Execute as COO-level engineer. Zero debt, complete implementation.

---

## MANDATORY BOOTSTRAP

Load in order:

1. `D:\Dev\CLAUDE_INSTRUCTIONS.md`
2. `D:\Dev\TECHNICAL_STANDARDS.md`
3. `D:\Projects\GregLite\DEV_PROTOCOLS.md`
4. `D:\Projects\GregLite\STATUS.md`
5. `D:\Projects\GregLite\BLUEPRINT_FINAL.md` — §8 fully
6. `D:\Projects\GregLite\SPRINT_4A_COMPLETE.md`
7. `D:\Projects\GregLite\SPRINT_4B_COMPLETE.md`

Baseline check:
```powershell
cd D:\Projects\GregLite\app
npx tsc --noEmit
pnpm test:run
```

---

## QUALITY GATES (PHASE 4 CERTIFICATION)

1. `npx tsc --noEmit` — zero errors
2. `pnpm test:run` — zero failures
3. Gate fires on all 5 implemented triggers in integration tests
4. Gate does NOT fire in 10 normal conversation scenarios (false positive test)
5. API lock enforcement verified — 423 returned under load
6. `getValueBoost()` stub from Phase 3 implemented (deferred from 3H)
7. STATUS.md updated with Phase 4 complete

---

## TASKS

### Task 1 — Integration test suite

Write a comprehensive integration test file `phase4-integration.test.ts` covering:

```typescript
describe('Decision Gate — end-to-end', () => {
  // Trigger fires correctly
  it('repeated_question fires after 3 same-topic messages')
  it('sacred_principle_risk fires on "just for now"')
  it('irreversible_action fires on "deploy to prod"')
  it('contradicts_prior fires when user message matches prior decision')
  it('low_confidence fires on 2+ uncertainty phrases')

  // Gate does NOT fire in normal conversation
  it('does not trigger on general architecture discussion')
  it('does not trigger on code review request')
  it('does not trigger on simple factual question')
  it('does not trigger on bug fix discussion')
  it('does not trigger on status update message')

  // Lock enforcement
  it('API returns 423 when lock is active')
  it('API returns 200 after lock is released')

  // Mandatory gate
  it('3 dismissals makes gate mandatory')
  it('mandatory gate requires rationale ≥20 chars')
  it('override without rationale is rejected')

  // KERNL logging
  it('approval writes to decisions table')
  it('override writes to decisions table with rationale')
});
```

### Task 2 — False positive calibration

Run the gate against 20 real conversation excerpts from the chat history in KERNL. Count how many false positives occur. If false positive rate >10%, tune the trigger thresholds:

- `repeated_question`: increase the phrase overlap threshold from 3 to 4 occurrences
- `low_confidence`: increase from 2 phrases to 3 phrases
- `sacred_principle_risk`: review phrase list, remove any ambiguous entries

Document the tuning decisions in SPRINT_4C_COMPLETE.md.

### Task 3 — Implement getValueBoost()

This was stubbed in Sprint 3G (always returns 1.0). Phase 4 is the natural home for it since it relates to decision importance. Implement a real value boost based on whether a suggestion is connected to a prior KERNL decision:

```typescript
// In app/lib/cross-context/value-boost.ts
export async function getValueBoost(chunkId: string): Promise<number> {
  // 1.5 if the chunk's source thread contains a logged decision
  const chunk = kernl.db.prepare(
    'SELECT source_id FROM content_chunks WHERE id = ?'
  ).get(chunkId) as any;
  if (!chunk) return 1.0;

  const hasDecision = kernl.db.prepare(
    'SELECT 1 FROM decisions WHERE thread_id = ? LIMIT 1'
  ).get(chunk.source_id);

  return hasDecision ? 1.5 : 1.0;
}
```

Verify this doesn't break any Phase 3 tests (it shouldn't — the stub returned 1.0, any real implementation returning ≥1.0 will only raise scores, not lower them).

### Task 4 — Performance measurement

Measure and log:

```typescript
// How long does analyze() take on a 20-message conversation?
const t0 = Date.now();
await analyze(last20Messages);
console.log(`gate analysis: ${Date.now() - t0}ms`);

// How long does the Haiku inference call take?
const t1 = Date.now();
await inferStructuredTriggers(last5Messages);
console.log(`haiku inference: ${Date.now() - t1}ms`);
```

Target: `analyze()` under 100ms excluding the Haiku call. Haiku call is fire-and-forget so wall-clock is acceptable up to 3s.

### Task 5 — Status bar cleanup

Verify the "COUNCIL: N pending" badge in the status bar matches the actual gate state correctly. Edge cases to test:
- App restarts with gate active — badge should NOT show (lock is in-memory, not persisted across restarts)
- Multiple rapid messages — badge should show at most 1 pending gate at a time
- Approve clears badge immediately

### Task 6 — Update BLUEPRINT_FINAL.md

Mark Phase 4 complete in §13. Note measured false positive rate and any phrase list changes.

### Task 7 — Phase 5 readiness

Phase 5 is the Quality Layer (SHIM native module + Eye of Sauron). Read §11. Note any dependencies Phase 5 will need from Phase 4 infrastructure. Record in SPRINT_4C_COMPLETE.md.

---

## SESSION END

1. Zero errors, zero failures
2. Update `D:\Projects\GregLite\STATUS.md` — Phase 4 complete
3. Update `D:\Projects\GregLite\BLUEPRINT_FINAL.md` — Phase 4 completion noted in §13
4. `git commit -m "phase-4: complete — decision gate, trigger detection, API lock, KERNL logging"`
5. `git push`
6. Write `SPRINT_4C_COMPLETE.md` with: false positive rate measured, phrase list changes, getValueBoost() implemented, Haiku inference latency, Phase 5 dependencies

---

## GATES CHECKLIST (PHASE 4 CERTIFICATION)

- [ ] All 5 trigger conditions covered by integration tests and passing
- [ ] 10 normal conversation scenarios do NOT trigger gate (false positive test)
- [ ] API lock returns 423 under test
- [ ] 3-dismissal mandatory gate enforced
- [ ] Override requires rationale ≥20 chars
- [ ] All approvals/overrides logged to KERNL decisions table
- [ ] `getValueBoost()` implemented (no longer stub)
- [ ] Performance: `analyze()` under 100ms on 20-message conversation
- [ ] Status bar badge correctly reflects gate state
- [ ] `npx tsc --noEmit` zero errors
- [ ] `pnpm test:run` zero failures
- [ ] Phase 4 completion commit pushed
