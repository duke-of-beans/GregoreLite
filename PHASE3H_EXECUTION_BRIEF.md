# GREGLITE — SPRINT 3H EXECUTION BRIEF
## Phase 3 End-to-End Integration + Hardening
**Instance:** Sequential after 3G (final Phase 3 sprint)
**Created:** March 1, 2026
**Project:** D:\Projects\GregLite\
**Depends on:** All Phase 3 sprints (3A–3G) complete

---

## YOUR ROLE

Bounded execution worker. You are hardening the Cross-Context Engine end-to-end — verifying every integration point, measuring real performance, and certifying Phase 3 complete. This is the integration and measurement sprint, not a feature sprint. David is CEO. Execute as COO-level engineer. Zero debt, complete implementation.

---

## MANDATORY BOOTSTRAP

Load in order:

1. `D:\Dev\CLAUDE_INSTRUCTIONS.md`
2. `D:\Dev\TECHNICAL_STANDARDS.md`
3. `D:\Projects\GregLite\DEV_PROTOCOLS.md`
4. `D:\Projects\GregLite\STATUS.md`
5. `D:\Projects\GregLite\BLUEPRINT_FINAL.md` — §5 fully, all subsections
6. All SPRINT_3*_COMPLETE.md files — read them all to understand actual implementations

Baseline check:
```powershell
cd D:\Projects\GregLite\app
npx tsc --noEmit
pnpm test:run
```

---

## AUTHORITY PROTOCOL — STOP WHEN:

- A performance target cannot be met without significant architectural change — report the gap, do not hack around it
- An integration point between two sprints is broken in a way that requires rewriting one sprint's output — report before touching anything

---

## QUALITY GATES (ALL REQUIRED — PHASE 3 IS NOT DONE UNTIL ALL PASS)

1. `npx tsc --noEmit` — zero errors
2. `pnpm test:run` — zero failures
3. k=10 similarity query under 200ms with 1000+ indexed chunks (measured)
4. On-input suggestion check under 500ms (measured, fire-and-forget so this is wall-clock)
5. Indexer runs without errors for a full 30-minute cycle
6. Gate fires correctly on a manifest with >0.72 similarity match
7. No suggestion cards appear if no relevant content exists
8. STATUS.md updated with Phase 3 complete + all measurements

---

## TASKS

### Task 1 — Integration audit

For each integration point, verify it actually works end-to-end:

| Integration | What to verify |
|-------------|---------------|
| Chat route → 3A | `content_chunks` row written after every assistant response |
| 3A → 3B | `vec_index` row written for every `content_chunks` row |
| 3C Tier 1 | `hot_cache.bin` written to `%APPDATA%\greglite\` |
| 3C Tier 2 | Warm cache builds without errors on boot |
| 3D indexer | Unindexed chunks get indexed on next 30-min cycle |
| 3D AEGIS throttle | Set AEGIS profile to PARALLEL_BUILD manually, verify indexer skips |
| 3E calibration | Submit 100 feedback events, verify thresholds drift |
| 3F gate | Create manifest with description matching prior chat content, verify modal fires |
| 3G surfacing | Send message similar to past conversation, verify suggestion card appears |

### Task 2 — Performance measurements

Run these benchmarks and record results in SPRINT_3H_COMPLETE.md:

```typescript
// Benchmark 1: similarity query latency
const t0 = Date.now();
await findSimilarChunks('test query about building a chat interface', 10, 0.70);
console.log(`k=10 query: ${Date.now() - t0}ms`);

// Benchmark 2: on-input check latency
const t1 = Date.now();
await checkOnInput('I want to build a background indexer that runs every 30 minutes');
console.log(`on-input check: ${Date.now() - t1}ms`);

// Benchmark 3: Tier 1 hot cache query
const t2 = Date.now();
searchHotCache(testEmbedding, 10);
console.log(`hot cache k=10: ${Date.now() - t2}ms`);
```

Seed the index with at least 1000 chunks before benchmarking. Use `app/scripts/seed-vectors.ts` from Sprint 3B, or extend it to 1000 entries.

### Task 3 — Missing test coverage

Sprint 3 moved fast. Write integration tests for any missing coverage:

- Embedding → content_chunks → vec_index pipeline (one message → three tables populated)
- Threshold calibration (mock 100 dismissed events → verify threshold drifts up)
- Suppression enforcement (3 dismissals → isSuppressed returns true)
- Gate interception (mock manifest → verify checkBeforeManifest returns shouldIntercept: true)
- Surfacing max 2 (mock 10 candidates → verify only 2 returned)

### Task 4 — Fix any broken integration points

If any Task 1 verification fails, fix it before continuing. Document what was broken and what the fix was in SPRINT_3H_COMPLETE.md.

### Task 5 — Update STATUS.md

Mark Phase 3 complete. Record:
- k=10 query latency at 1000 chunks
- On-input check latency
- Hot cache query latency
- Indexer cycle time (30-min cadence observed)
- Gate fire rate (% of manifests intercepted in testing)
- Cold start time (updated from Phase 1 baseline)

### Task 6 — Update BLUEPRINT_FINAL.md

In §13 Build Order, mark Phase 3 complete with date and measurements.

### Task 7 — Phase 4 readiness check

Phase 4 is the Decision Gate system (§8). Read §8 now. Identify any schema or module dependencies Phase 4 will need from Phase 3 infrastructure. Note them in SPRINT_3H_COMPLETE.md so Phase 4 briefing can be accurate.

---

## SESSION END

1. Zero errors, zero failures
2. Update STATUS.md — Phase 3 complete, all measurements recorded
3. Update BLUEPRINT_FINAL.md — Phase 3 completion noted
4. Final commit: `git commit -m "phase-3: complete — cross-context engine, vector index, proactive surfacing"`
5. `git push`
6. Write `SPRINT_3H_COMPLETE.md` with:
   - All benchmark measurements
   - All integration fixes applied
   - Phase 4 dependencies identified
   - Anything deferred to Phase 4 or later

---

## GATES CHECKLIST (PHASE 3 CERTIFICATION)

- [ ] k=10 similarity query under 200ms at 1000+ chunks (measured and logged)
- [ ] On-input suggestion check under 500ms (measured and logged)
- [ ] Hot cache Tier 1 query under 5ms (measured and logged)
- [ ] Chat → content_chunks → vec_index pipeline verified end-to-end
- [ ] Background indexer runs full cycle without errors
- [ ] AEGIS PARALLEL_BUILD → indexer skips (verified)
- [ ] Threshold calibration drifts correctly after 100 feedback events
- [ ] Gate fires on similar manifest (verified with real test)
- [ ] Suggestion card appears after sending relevant message (verified)
- [ ] Max 2 suggestion cards enforced
- [ ] 4-hour auto-expire works
- [ ] All Phase 3 sprint integration tests green
- [ ] `npx tsc --noEmit` zero errors
- [ ] `pnpm test:run` zero failures
- [ ] STATUS.md updated with Phase 3 complete + all measurements
- [ ] Phase 3 completion commit pushed
