# GREGORE LITE — STATUS
**Last Updated:** March 2, 2026 — PHASE 6 COMPLETE. Sprint 6I: 33-test integration suite (phase6-integration.test.ts), [UNTRUSTED CONTENT] security audit verified on all Ghost→Claude API paths, EoS self-scan 82/100 (303 files, no regression), performance measurements (JS startup <1ms, shutdown <1ms, all targets met), BLUEPRINT_FINAL.md §13 Phase 6 entry updated, 736/736 tests passing.
**Phase:** Phase 7 — Self-Evolution Mode (next)

---
**Previous:** Sprint 6G complete: Privacy Dashboard UI, 6 API routes (items/exclusions/log/watch-paths/status/purge), 5 React components (GhostStatusBadge, IndexedItemRow, ExclusionLog, IndexedItemsList, ExclusionRules, WatchPaths, PurgeAllDialog, PrivacyDashboard), cascade delete + purge-all, exclusion log retention cap, deleteGhostItem()  
**Phase:** Phase 6 — Ghost Thread (Sprint 6G complete, 6H next)

---

## Current State

Phase 1 complete. App has a working strategic thread with KERNL SQLite persistence, diff-based crash recovery, and bootstrap context injection. All 5 sequential sprints passed type-check (0 errors) and test suite (24/24 passing). Header shows "Gregore Lite". Zero Gregore orchestration imports in active code.

**Cold start baseline:** Bootstrap completes in <1s on warm dev server (dev protocols loaded from disk, KERNL queried, system prompt assembled). Under 60s target met with significant margin.

## Completed

- [x] Council Round 1 — all LLMs deliberated independently
- [x] Council Round 2 — final synthesis produced
- [x] Q&A session — seven blueprint amendments identified and resolved
- [x] Project directory and blueprint infrastructure created
- [x] BLUEPRINT_FINAL.md v1.1.0
- [x] DEV_PROTOCOLS.md, PROJECT_DNA.yaml, HANDOFF.md
- [x] **PHASE 0 COMPLETE** — Gregore scaffold copied, orchestration layer stripped, app boots clean
- [x] Sprint blueprints written: 1A–1E (sequential), 2A–2E (parallel)
- [x] **SPRINT 1A** — Foundation cleanup, chat route rewritten (direct Anthropic SDK), 0 TS errors
- [x] **SPRINT 1B** — KERNL native module: SQLite WAL, 7 files, threads/messages/decisions/checkpoints, wired into chat route
- [x] **SPRINT 1C** — Continuity checkpointing: diff-based, crash recovery, boot restore via /api/restore, wired into ChatInterface
- [x] **SPRINT 1D** — Bootstrap sequence: dev protocols loaded from disk, KERNL context hydrated, context injection package built and cached, AEGIS stub, /api/bootstrap endpoint
- [x] **SPRINT 1E** — Phase 1 gate: all hard gates passed, Header branded "Gregore Lite", grep audit clean
- [x] **PHASE 1 COMPLETE** — commit: `phase-1: complete — working strategic thread, KERNL persistence, crash recovery, bootstrap sequence`

## Phase 1 Gate Results

| Gate | Result |
|------|--------|
| pnpm type-check | ✅ 0 errors |
| pnpm test:run | ✅ 24/24 passing |
| Zero Gregore imports | ✅ Clean |
| Header "Gregore Lite" | ✅ Done |
| KERNL persistence | ✅ better-sqlite3, WAL mode |
| Crash recovery | ✅ diff checkpoints, boot restore |
| Bootstrap sequence | ✅ dev protocols + KERNL context injected |
| Cold start | ✅ <1s (dev), target was <60s |

## Active: Phase 2 — Parallel Sprints

- [x] **SPRINT 2A** — Agent SDK integration, job queue UI — **COMPLETE** (2 sessions)
- [x] **SPRINT 2B** — Context panel + KERNL UI — **COMPLETE** (1 session)
- [x] **SPRINT 2C** — AEGIS integration, workload signaling — **COMPLETE** (2 sessions)
- [x] **SPRINT 2D** — Artifact rendering: Monaco, Sandpack, Shiki, 3-panel layout — **COMPLETE** (3 sessions)
- [x] **SPRINT 2E** — War Room dependency graph UI — **COMPLETE** (2 sessions)

## Sprint 2A Gate Results

| Gate | Result |
|------|--------|
| tsc --noEmit | ✅ 0 errors |
| pnpm test:run (full suite) | ✅ 140/140 passing (40 new) |
| zod installed | ✅ Done |
| manifests table (schema.sql + INLINE_SCHEMA) | ✅ Done |
| types.ts + config.ts | ✅ Done |
| manifest.ts (buildManifest, buildAgentSystemPrompt, validateManifest) | ✅ Done |
| job-tracker.ts (insertManifest, transitionState, markStale, getRow) | ✅ Done |
| cost-tracker.ts (CostTracker class + costTracker singleton) | ✅ Done |
| executor.ts (runSession streaming wrapper) | ✅ Done |
| index.ts public API (spawn, kill, status, list) | ✅ Done |
| JobCard.tsx + JobQueue.tsx + ManifestBuilder.tsx | ✅ Done |
| app/jobs/page.tsx (jobs route) | ✅ Done |
| agent-sdk.test.ts (40 tests covering all modules) | ✅ Done |
| STATUS.md updated | ✅ Done |
| Conventional commit + push | ✅ Done |

### Sprint 2A Key Discoveries

- **exactOptionalPropertyTypes**: All optional fields in object literals require conditional spread — `...(x !== undefined && { key: x })` — not direct assignment.
- **noUncheckedIndexedAccess**: `RegExpExecArray[1]` is `string | undefined`. Use `match?.[1] ?? 'fallback'` not `match ? match[1] : 'fallback'`.
- **GREGORE PowerShell hook**: The GREGORE profile intercepts `&` operator calls and swallows stdout. TSC / vitest must be invoked via `Start-Process` with `-RedirectStandardOutput/-RedirectStandardError` files.
- **TSC incremental cache**: `.next/tsconfig.tsbuildinfo` returns false exit 0. Delete it and use `--incremental false` for reliable TSC output.
- **CostTracker sessionId**: Uses auto-generated nanoid, not manifestId. `startSession(model): string` returns the ID — callers must store it.
- **aegis/index.ts gap**: Sprint 2C left `lib/aegis/` with only `types.ts`. Sprint 2A created the full `index.ts` stub to satisfy bootstrap imports.

## Sprint 2C Gate Results

| Gate | Result |
|------|--------|
| tsc --noEmit | ✅ 0 errors |
| pnpm test:run (full suite) | ✅ 140/140 passing |
| aegis module (types, client, governor, index) | ✅ Done |
| AEGISGovernor — 5s poll, 5s anti-flap | ✅ Done |
| initAEGIS / shutdownAEGIS / getAEGISStatus | ✅ Done |
| Bootstrap wired (initAEGIS on boot) | ✅ Done |
| POST /api/bootstrap sends STARTUP signal | ✅ Done |
| GET /api/context returns aegisOnline field | ✅ Done |
| POST /api/aegis/override route | ✅ Done |
| AEGISStatus.tsx — status bar display + override modal | ✅ Done |
| aegis.test.ts — 31 new tests | ✅ Done |
| KERNL logging (logAegisSignal) | ✅ Done |
| STATUS.md updated | ✅ Done |
| Conventional commit + push | ✅ Done |

### Sprint 2C Key Discoveries

- **AEGIS API**: `POST /switch {profile: string}` on port 8743 (not `/signal` as spec suggested). Discovered from `D:\Dev\aegis\src\status\server.ts`.
- **Profile mapping**: 10 GregLite `WorkloadProfile` names → 6 AEGIS native names (`idle`, `build-mode`, `deep-research`, `performance`, `wartime`, `presentation`). Map lives in `types.ts`.
- **VM/Windows filesystem split**: Cowork VM Write tool writes to VM-local paths only. All production file writes must go through Desktop Commander to reach the real Windows filesystem.
- **vitest hoisting**: `vi.mock()` factories are hoisted before `const` declarations. Must use `vi.hoisted()` for mock variables referenced inside factory functions.
- **pnpm + PowerShell**: `.cmd` shims in pnpm paths fail silently in PowerShell. Test runner must use `shell: cmd`. Created `run-tests.cmd` helper.

## Sprint 2B Gate Results

| Gate | Result |
|------|--------|
| Sprint 2B tsc errors introduced | ✅ 0 new errors |
| pnpm test:run (Sprint 2B tests) | ✅ 25/25 passing |
| pnpm test:run (full suite) | ✅ 67/67 passing |
| aegis_signals table added to schema.sql | ✅ Done |
| project-store.ts + aegis-store.ts | ✅ Done |
| GET /api/context route | ✅ Done |
| ContextPanel + 7 sub-components | ✅ Done |
| Layout wired (20% panel + flex chat) | ✅ Done |
| Cmd+B shortcut registered | ✅ Done |
| scripts/seed-kernl.ts | ✅ Done |
| STATUS.md updated | ✅ Done |
| Conventional commit + push | ✅ Done |

## Sprint 2D Gate Results

| Gate | Result |
|------|--------|
| tsc --noEmit | ✅ 0 errors |
| pnpm test:run (full suite) | ✅ 140/140 passing |
| lib/artifacts/ (types, detector, store, kernl-sync, index) | ✅ Done |
| app/api/kernl/artifact/route.ts | ✅ Done |
| ArtifactToolbar, CodeArtifact, MarkdownArtifact, SandpackArtifact, ArtifactPanel | ✅ Done |
| Message.tsx — Shiki inline syntax highlighting + copy button | ✅ Done |
| ChatInterface.tsx — artifact detection + 3-panel layout | ✅ Done |
| artifacts/detector.test.ts (11 tests) | ✅ Done |
| artifacts/store.test.ts (7 tests) | ✅ Done |
| lib/aegis/ — full Sprint 2C impl (governor, anti-flap, lifecycle) | ✅ Done |
| CostTracker API redesign — startSession(model): string, totalCostUsd, getCostCapStatus | ✅ Done |
| executor.ts updated to new CostTracker API | ✅ Done |
| STATUS.md updated | ✅ Done |
| Conventional commit + push | ✅ Done |

### Sprint 2D Key Discoveries

- **vitest batch runner**: PowerShell `Start-Process` + `ReadToEnd()` hangs when vitest spawns worker processes that inherit the stdout pipe handle. Fixed by using a `.bat` file with `>` file redirection (`> D:\test_out.txt 2>&1`) launched via `cmd.exe -WindowStyle Hidden`.
- **CMD `set` quoting**: `set PATH=D:\Program Files\nodejs;...` breaks on spaces — `Program` is the value, `Files\nodejs;...` is discarded. Must use `set "PATH=D:\Program Files\nodejs;..."` (quotes around the whole assignment).
- **Full-path binary calls**: When PATH manipulation is unreliable, use absolute paths directly: `"D:\Program Files\nodejs\node.exe"`, `"D:\Program Files\Git\cmd\git.exe"`. Bypasses all PATH ambiguity.
- **TSC incremental cache**: `incremental: true` in tsconfig causes false-positive clean runs (exit 0, 0.5s). Must delete `tsconfig.tsbuildinfo` before each clean check.
- **AEGIS forward references**: Sprint 2B/2C wrote imports to `@/lib/aegis/governor` and `@/lib/aegis/types` before the module existed. Sprint 2D created the full implementation to unblock tsc.
- **CostTracker API drift**: Sprint 2A tests spec'd `startSession(model): string` but implementation had `startSession(id, model): void`. Test is canonical spec — implementation updated to match.

## Sprint 2E Gate Results

| Gate | Result |
|------|--------|
| tsc --noEmit | ✅ 0 errors |
| pnpm test:run (full suite) | ✅ 161/161 passing (21 new) |
| lib/war-room/ (types, graph-builder, poller) | ✅ Done |
| dagre layout (rankdir LR, ranksep 80, nodesep 40) | ✅ Done |
| GET /api/kernl/manifests | ✅ Done |
| WarRoomEmpty, JobNode, JobEdge, ManifestDetail, DependencyGraph, WarRoom | ✅ Done |
| Tab bar (Strategic / Workers / War Room) in ChatInterface | ✅ Done |
| Cmd+W toggle shortcut | ✅ Done |
| KeyboardShortcuts.tsx updated | ✅ Done |
| scripts/seed-manifests.ts | ✅ Done |
| war-room.test.ts (21 tests) | ✅ Done |
| STATUS.md updated | ✅ Done |
| Conventional commit + push | ✅ Done |

### Sprint 2E Key Discoveries

- **dagre ESM import**: `graph-builder.ts` uses top-level `import dagre from 'dagre'` making it ESM. vitest tests must use `await import()` not `require()` — all tests in the file affected, not just those that directly use dagre.
- **vi.runAllTimersAsync() + setInterval = infinite loop**: `vi.runAllTimersAsync()` fires all pending timers repeatedly until none remain — a `setInterval` never finishes. Use `vi.advanceTimersByTimeAsync(0)` to flush the immediate async tick and `vi.advanceTimersByTimeAsync(5000)` to advance one poll interval.
- **nodeHeight unused in bezier edge**: dagre outputs center-point positions; the edge bezier path only needs `nodeWidth` (to offset from left/right edge of each node). `nodeHeight` was declared but never used — removed from JobEdge interface.
- **CSS variable aliases**: `--muted` and `--ghost-text` were referenced in War Room components but not defined in globals.css. Added as color aliases alongside existing design tokens.

## Sprint Blueprint Files

| File | Sprint | Status |
|------|--------|--------|
| SPRINT_1A_Foundation.md | Phase 1, Session 1 | ✅ Complete |
| SPRINT_1B_KERNL.md | Phase 1, Session 2 | ✅ Complete |
| SPRINT_1C_Continuity.md | Phase 1, Session 3 | ✅ Complete |
| SPRINT_1D_Bootstrap.md | Phase 1, Session 4 | ✅ Complete |
| SPRINT_1E_Phase1Gate.md | Phase 1, Session 5 | ✅ Complete |
| SPRINT_2A_AgentSDK.md | Phase 2, Parallel A | Ready |
| SPRINT_2B_ContextPanel.md | Phase 2, Parallel B | ✅ Complete |
| SPRINT_2C_AEGIS.md | Phase 2, Parallel C | Ready |
| SPRINT_2D_Artifacts.md | Phase 2, Parallel D | Ready |
| SPRINT_2E_WarRoom.md | Phase 2, Parallel E | Ready |
| PHASE2A_EXECUTION_BRIEF.md | Cowork prompt — Instance A | Ready |
| PHASE2B_EXECUTION_BRIEF.md | Cowork prompt — Instance B | Ready |
| PHASE2C_EXECUTION_BRIEF.md | Cowork prompt — Instance C | Ready |
| PHASE2D_EXECUTION_BRIEF.md | Cowork prompt — Instance D | Ready |
| PHASE2E_EXECUTION_BRIEF.md | Cowork prompt — Instance E | Ready |

## Queued: Phase 3 — Intelligence Layer (after Phase 2 complete)

Execution order: 3A → 3B → 3C → (3D ∥ 3E) → 3F → 3G → 3H

- [x] **SPRINT 3A** — Embedding pipeline (bge-small-en-v1.5, chunker, content_chunks) — **COMPLETE**
- [x] **SPRINT 3B** — sqlite-vec integration (vector store, cosine search) — **COMPLETE**
- [x] **SPRINT 3C** — Three-tier cold start warming (hot_cache.bin, 30-day in-memory, full index) — **COMPLETE**
- [x] **SPRINT 3D** — Background indexer + AEGIS throttling (30-min cadence, 500ms budget) — **COMPLETE**
- [x] **SPRINT 3E** — Suggestion feedback + threshold calibration (can run parallel with 3D) — **COMPLETE**
- [x] **SPRINT 3F** — "You already built this" gate (manifest interception modal, Monaco diff) — **COMPLETE**
- [x] **SPRINT 3G** — Ranking, suppression + proactive surfacing UI (suggestion cards) — **COMPLETE**
- [x] **SPRINT 3H** — Phase 3 end-to-end integration + hardening gate — **COMPLETE**

## Phase 3 Gate Results (COMPLETE — March 1, 2026)

| Gate | Result |
|------|--------|
| tsc --noEmit | ✅ 0 errors |
| pnpm test:run | ✅ 374/374 passing (19 test files) |
| k=10 query @ 1000 chunks | ✅ 1.66ms (gate: <200ms — 120× under target) |
| Hot cache k=10 @ 1000 records | ✅ 2.36ms (gate: <5ms) |
| On-input check latency | ✅ <10ms (fire-and-forget, no blocking) |
| Embedding → content_chunks → vec_index pipeline | ✅ Verified (integration test) |
| Feedback loop → calibration trigger at 100 events | ✅ Verified (integration test) |
| Suppress-then-hide cycle (3 dismissals → isSuppressed) | ✅ Verified (integration test) |
| Gate interception (manifest similarity → modal) | ✅ Verified (integration test) |
| Surfacing max-2 cap enforced | ✅ Verified (integration test) |
| Suggestion card 4h auto-expire | ✅ Verified (unit test with fake timers) |
| Phase 3 certification commit pushed | ✅ Done |

### Phase 3 Key Discoveries (Sprint 3H)

- **vi.mock hoisting + vi.hoisted**: `const` declarations after `vi.mock()` are not yet initialized when the mock factory runs (factories are hoisted). Any value referenced inside a mock factory must be declared with `vi.hoisted(() => ({ ... }))` — not as a module-level `const`.
- **better-sqlite3 native bindings**: The `.node` addon is compiled per Node ABI version. `npx tsx` on Node 22 (ABI 127) finds no prebuilt binary. Fix: `npx node-gyp rebuild` in the better-sqlite3 package directory.
- **Calibration time condition**: `recordFeedback` triggers calibration if `eventCount >= 100` OR `timeElapsed >= CALIBRATION_INTERVAL_MS`. Test mocks must suppress the time condition (set `getLastCalibrationTime` → `Date.now()`) when testing the "below event threshold" branch.
- **db.transaction() mock**: `better-sqlite3` `.transaction(fn)` returns a callable wrapper. Mock must return a function: `vi.fn().mockImplementation((fn) => (...args) => fn(...args))`.

## Phase 3 Execution Briefs

| File | Sprint |
|------|--------|
| PHASE3A_EXECUTION_BRIEF.md | Embedding pipeline |
| PHASE3B_EXECUTION_BRIEF.md | sqlite-vec vector store |
| PHASE3C_EXECUTION_BRIEF.md | Three-tier cold start |
| PHASE3D_EXECUTION_BRIEF.md | Background indexer |
| PHASE3E_EXECUTION_BRIEF.md | Feedback + calibration |
| PHASE3F_EXECUTION_BRIEF.md | Already-built gate |
| PHASE3G_EXECUTION_BRIEF.md | Proactive surfacing UI |
| PHASE3H_EXECUTION_BRIEF.md | Integration + hardening |

## Queued: Phase 4 — Decision Gate (after Phase 3 complete)

Execution order: 4A → 4B → 4C (all sequential)

- [x] **SPRINT 4A** — Trigger detection (8 conditions, 5 live + 3 stubs) — **COMPLETE**
- [x] **SPRINT 4B** — UI panel + API lock enforcement + Haiku inference for 3 stubbed triggers — **COMPLETE**
- [x] **SPRINT 4C** — Integration hardening, false positive calibration, Phase 4 certification — **COMPLETE**

## Phase 4 Execution Briefs

| File | Sprint |
|------|--------|
| PHASE4A_EXECUTION_BRIEF.md | Trigger detection |
| PHASE4B_EXECUTION_BRIEF.md | UI + API lock |
| PHASE4C_EXECUTION_BRIEF.md | Integration + certification |

## Sprint 4A Gate Results (COMPLETE — March 1, 2026)

| Gate | Result |
|------|--------|
| tsc --noEmit | ✅ 0 errors |
| pnpm test:run | ✅ 417/417 passing (20 test files, 43 new) |
| decision-gate/types.ts | ✅ GateTrigger union, TriggerResult, DecisionLockState, GateMessage |
| decision-gate/lock.ts | ✅ acquireLock, releaseLock, dismissLock, isMandatory, mandatory at count ≥ 3 |
| repeated_question | ✅ Live — n-gram (uni+bi+tri), window=10, threshold=3 |
| sacred_principle_risk | ✅ Live — 18-phrase exact match, window=5 |
| irreversible_action | ✅ Live — 18 regex patterns, last assistant message only |
| low_confidence | ✅ Live — 20 uncertainty phrases, ≥2 threshold |
| contradicts_prior | ✅ Live — findSimilarChunks() ≥ 0.80, source_type = 'decision', fail-open |
| high_tradeoff_count | 🔲 Stub — always false, Sprint 4B activates via Haiku |
| multi_project_touch | 🔲 Stub — always false, Sprint 4B activates via Haiku |
| large_build_estimate | 🔲 Stub — always false, Sprint 4B activates via Haiku |
| decision-gate-store.ts | ✅ Zustand store, session-only (no persistence) |
| chat route wired | ✅ Fire-and-forget analyze() after checkpoint(), setTrigger on match |
| SPRINT_4A_COMPLETE.md | ✅ Written |
| Conventional commit + push | ✅ Done |

### Sprint 4A Key Discoveries

- **`triggered()` helper pattern**: `analyze()` can't pass `result.trigger` (typed `GateTrigger | null`) to `acquireLock()` which requires `GateTrigger`. Solution: introduce `triggered(trigger: GateTrigger, reason: string): TriggerResult` helper that takes the concrete string literal — avoids non-null assertions, TypeScript satisfied.
- **n-gram test data quality**: `detectRepeatedQuestion` extracts unigrams + bigrams + trigrams after stop-word filtering. Any word shared across 3+ messages triggers it. Negative-case tests must use genuinely unique vocabulary per message — even "topic" appearing in 8 filler messages will correctly fire the detector.
- **Stubs as `async Promise<false>`**: All 3 stubs return `Promise<false>` consistent with the live async detectors they'll replace. `analyze()` needs no refactor when Sprint 4B activates them.
- **CMD `/d` flag for drive change**: `cd D:\path` fails silently in cmd when current drive differs. Must use `cd /d D:\path` to switch drives.

## Phase 4 Gate Results (COMPLETE — March 2, 2026)

| Gate | Result |
|------|--------|
| tsc --noEmit | ✅ 0 errors |
| pnpm test:run | ✅ 474/474 passing (22 test files) |
| All 5 live triggers fire in integration tests | ✅ Verified |
| 10 normal scenarios — no false positives | ✅ 0% FP rate |
| 423 API lock enforcement | ✅ Verified |
| Mandatory gate (3 dismissals) | ✅ Verified |
| Override requires rationale ≥20 chars | ✅ Verified |
| Approvals/overrides logged to KERNL | ✅ KERNL write-first ordering enforced |
| getValueBoost() real implementation | ✅ Queries decisions table (1.5×) |
| analyze() sync path < 100ms | ✅ 1ms on 20-message conversation |
| BLUEPRINT_FINAL.md §13 updated | ✅ Phase 4 complete noted |
| Phase 4 certification commit pushed | ✅ Done |

### Phase 4 Key Discoveries (Sprint 4C)

- **n-gram test data quality**: `detectRepeatedQuestion` fires on shared vocabulary across messages — even common words like "approach" in filler messages will trigger it. Integration test filler messages must use genuinely distinct phrasing per exchange.
- **Exact phrase matching for low_confidence**: The detector requires the exact phrase `"i'm not sure"`, not approximate variants like `"not entirely sure"`. Approximate language reduces FPs in production; tests must use canonical phrases.
- **Mocked releaseLock in lock machine tests**: When `releaseLock` is partially mocked via `vi.mock(async (importOriginal) => ({ ...actual, releaseLock: mockFn }))`, the real release behaviour is suppressed. Use `_resetLockState()` directly for lock state machine tests; reserve the `mockReleaseLock` for KERNL logger call-order assertions.
- **getValueBoost() must stay synchronous**: better-sqlite3 is synchronous by design. Making `getValueBoost` async would require cascading `scoreCandidate()` → `rankAndFilter()` → all callers to also be async. The synchronous DB call pattern is correct for this module.

## Sprint 4B Gate Results (COMPLETE — March 2, 2026)

| Gate | Result |
|------|--------|
| tsc --noEmit | ✅ 0 errors |
| pnpm test:run | ✅ 440/440 passing (23 new, 21 test files) |
| Haiku inference (happy path + fail-open) | ✅ Verified (clean JSON, fenced JSON, bad JSON, API error, empty messages) |
| Haiku — last 5 messages only | ✅ Verified |
| 423 lock enforcement | ✅ getLockState integration verified |
| logGateApproval — KERNL schema + call order | ✅ releaseLock fires after logDecision |
| dismissCount store shape | ✅ init, setTrigger, setDismissCount, clearTrigger |
| analyze() structured triggers | ✅ highTradeoff→high_tradeoff_count, multiProject→multi_project_touch, largeEstimate→large_build_estimate |
| Sync triggers short-circuit Haiku | ✅ repeated_question fires before inference |
| SPRINT_4B_COMPLETE.md | ✅ Written |
| Conventional commit + push | ✅ Done |

### Sprint 4B Key Discoveries

- **vitest class constructor mock**: `vi.fn().mockImplementation(...)` produces a plain function — `new Anthropic()` throws `TypeError: ... is not a constructor`. Fix: use `class { messages = { create: mockCreate }; }` in the mock factory. vitest warning "did not use 'function' or 'class'" is the signal.
- **dismissCount threading**: Count comes from the server's `getLockState()` via the fire-and-forget `setTrigger(result, dismissCount)` call. GatePanel reads it from Zustand — no extra client round-trips.
- **Server/client KERNL boundary**: `logDecision()` is better-sqlite3 (Node.js only). Client components call API routes; `kernl-logger.ts` is server-side only. Never import it from a client component.
- **NextResponse vs Response in safeHandler**: `safeHandler` return type is `Promise<NextResponse<unknown>>`. Bare `new Response(...)` causes a TypeScript error. Must use `NextResponse.json({ ... }, { status: 423 })`.

## Queued: Phase 5 — Quality Layer (after Phase 4 complete)

Execution order: 5A → 5B → 5C (all sequential)

- [x] **SPRINT 5A** — Eye of Sauron native integration — **COMPLETE** (527/527 tests, 0 tsc errors)
- [x] **SPRINT 5B** — SHIM PatternLearner migration + FP feedback UI — **COMPLETE** (553/553 tests, 0 tsc errors)
- [x] **SPRINT 5C** — Integration hardening, self-scan, PatternLearner seeding, War Room badge, Phase 5 certification — **COMPLETE** (584/584 tests, 0 tsc errors)

## Sprint 5A Gate Results (COMPLETE — March 2, 2026)

| Gate | Result |
|------|--------|
| tsc --noEmit | ✅ 0 errors |
| pnpm test:run | ✅ 527/527 passing (27 test files, 53 new) |
| app/lib/eos/ — 9 module files | ✅ types, character, patterns, batch, debt, health-score, fp-tracker, engine, index |
| Character forensics (INVISIBLE_CHAR, HOMOGLYPH, SMART_QUOTE, GREEK_SEMICOLON, MIXED_INDENT) | ✅ Migrated from CharacterForensics.js |
| Pattern precognition (MEMORY_LEAK, EVENT_LISTENER_LEAK) | ✅ Migrated from PatternPrecognition.js |
| Health score formula: 100 − (critical×8) − (warning×2) − (cycles×10) | ✅ Clamped 0–100, 4 grades |
| FP tracker — recordOccurrence, markFalsePositive, getSuppressedRules, getRuleStats | ✅ KERNL-backed, 20% threshold over last 100 |
| KERNL schema — eos_fp_log, eos_reports tables | ✅ Added via ALTER TABLE IF NOT EXISTS |
| KERNL schema — projects.health_score, projects.last_eos_scan | ✅ Added |
| Agent SDK job-tracker hook | ✅ EoS quick scan fires after COMPLETED, persists health score |
| EoS tests — character.test.ts (10), patterns.test.ts (10), batch.test.ts (6), health-score.test.ts (13), fp-tracker.test.ts (14) | ✅ 53 new tests |
| SPRINT_5A_COMPLETE.md | ✅ Written |
| STATUS.md updated | ✅ Done |
| Conventional commit + push | ✅ Done |

### Sprint 5A Key Discoveries

- **exactOptionalPropertyTypes**: Building `HealthIssue` objects with `line: raw.line` fails when `raw.line` is `number | undefined` — optional properties cannot be assigned `undefined` directly. Pattern: build the base object then conditionally assign `if (raw.line !== undefined) issue.line = raw.line`.
- **Rule migration decision matrix**: Applied the brief's 20% FP threshold heuristic when deciding what to port. CONSOLE_USAGE and MISSING_CONTRACT_METHODS both rejected because they produce false positives on virtually every TypeScript/React file. SauronDependencyGraph rejected because it reads npm package-lock.json, not source import cycles.
- **Homoglyph context detection**: Cyrillic/Greek lookalikes inside string literals are legitimate user-facing text (i18n). The `isInStringOrComment()` helper prevents false positives on multilingual content — only flags homoglyphs in identifier/operator positions.
- **Pre-existing TS6133 baseline fix**: `phase4-integration.test.ts` had an unused import alias (`releaseLock as realReleaseLock`) that blocked clean tsc baseline. Fixed before writing any Phase 5 code.

## Phase 5 Execution Briefs

| File | Sprint |
|------|--------|
| PHASE5A_EXECUTION_BRIEF.md | EoS integration |
| PHASE5B_EXECUTION_BRIEF.md | PatternLearner + FP UI |
| PHASE5C_EXECUTION_BRIEF.md | Integration + certification |

## Source Projects

- `D:\Projects\eye-of-sauron\` — migrate: engine core, CharacterForensics, PatternPrecognition, BatchProcessor, DependencyGraph, TechnicalDebtCalculator. Skip: server, CLI, reporters, schedulers, license manager.
- `D:\Projects\SHIM\` — migrate: `src/ml/PatternLearner.ts` only. Skip: MLPredictor (stub), Redis/BullMQ coordination layer, MCP server.

## Sprint 5B Gate Results

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `pnpm test:run` | ✅ 553/553 passing (29 test files) |
| PatternLearner migrated | ✅ `app/lib/shim/pattern-learner.ts` |
| MLPredictor NOT migrated | ✅ Documented in SPRINT_5B_COMPLETE.md |
| shim_patterns + shim_improvements tables | ✅ In schema.sql |
| PatternLearner hydrates from KERNL | ✅ On construction |
| recordImprovement after COMPLETED | ✅ Via improvement-log.ts |
| predictSuccess before spawn | ✅ logPredictions() in executor.ts |
| shim_score_before stored at spawn | ✅ storeShimScoreBefore() |
| EoS issue rows in context panel | ✅ Quality section in ContextPanel.tsx |
| Dismiss (×) button fires POST `/api/eos/fp` | ✅ EoSIssueRow.tsx |
| FP route wired | ✅ `app/api/eos/fp/route.ts` |
| persistScanReport writes eos_reports | ✅ Replaces bare persistHealthScore |

## Phase 5 Gate Results (COMPLETE — March 2, 2026)

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `pnpm test:run` | ✅ 584/584 passing (30 test files) |
| EoS self-scan health score | ✅ 82/100 (Good) — 242 files, 208ms |
| phase5-integration.test.ts — 31 tests | ✅ All passing |
| EoS quality gate (eos_required + score<70 → FAILED) | ✅ Verified (integration test) |
| result_report backfill for War Room | ✅ quality_results.eos.healthScore written |
| EoS badge in JobNode.tsx | ✅ green/amber/red by scoreClass thresholds |
| scoreClass utility extracted | ✅ lib/eos/score-class.ts (no React/DB deps) |
| ContextPanel "No scan data" placeholder | ✅ Quality section always visible |
| PatternLearner seeding script | ✅ scripts/seed-patterns.ts — 20 records |
| EoS self-scan script | ✅ scripts/self-scan.ts |
| BLUEPRINT_FINAL.md §13 updated | ✅ Phase 5 complete noted |
| SPRINT_5C_COMPLETE.md | ✅ Written |
| Phase 5 certification commit pushed | ✅ Done |

### Phase 5 Key Discoveries (Sprint 5C)

- **EoS scanner comment gotcha**: `detectMemoryLeaks` uses `content.includes('clearInterval')` to bail out early. Any comment containing the literal word "clearInterval" (e.g., "without clearInterval") causes the detector to skip the file. Test fixtures must never include the suppression keyword in any form — including comments.
- **shim_improvements positional params**: `persistImprovement` calls `.run()` with 11 positional args, not a named-params object. Mocks that destructure `args[0]` as `{ id, pattern }` silently fail — use `const [id, pattern] = args as [string, string]` instead.
- **scoreClass extracted to avoid migration chain**: Importing `scoreClass` from `ContextPanel` in tests pulls `lib/database/migrations/index.ts` which reads SQL files from disk that don't exist in test environments. Extracting to `lib/eos/score-class.ts` breaks the chain entirely.
- **EoS deep mode catches test fixtures**: deep mode scans `*.test.ts` files. A `writeFileSync` string literal containing `setInterval(` inside a test file gets flagged as MEMORY_LEAK — it's a known false positive at score position 3 in the self-scan. The text-based scanner has no AST context.
- **PatternLearner DB errors expected in scripts**: `scripts/seed-patterns.ts` logs `no such table: shim_improvements` because Phase 5 migrations have not been applied to the dev database yet. In-memory PatternLearner functions correctly; persistence resumes once migration 006 runs.

## Sprint 6A Gate Results (COMPLETE — March 2, 2026)

| Gate | Result |
|------|--------|
| `cargo check` | ✅ 0 errors, 0 warnings |
| `npx tsc --noEmit` | ✅ 0 errors |
| `pnpm test:run` | ✅ 603/603 passing (31 test files, 19 new Ghost tests) |
| notify v6 Rust crate wired | ✅ `app/src-tauri/Cargo.toml` |
| FileChangeEvent + FileChangeKind | ✅ `ghost/events.rs` (Serialize/Deserialize for Tauri IPC) |
| should_exclude() — path-walk security | ✅ `ghost/exclusions.rs` (all 12 components walked, 25 unit tests) |
| Custom GhostDebouncer | ✅ `ghost/debouncer.rs` (750ms idle / 1500ms max, Arc<AtomicBool> stop flag) |
| GhostWatcherState (start/stop/pause/resume) | ✅ `ghost/watcher.rs` |
| Tauri commands registered | ✅ `ghost/mod.rs` + `main.rs` |
| KERNL settings-store | ✅ `lib/kernl/settings-store.ts` (getSetting/setSetting/delete) |
| GET+POST /api/ghost/settings | ✅ `app/api/ghost/settings/route.ts` |
| TypeScript Tauri bridge | ✅ `lib/ghost/watcher-bridge.ts` (startWatching/onFileChange/ghostPause/ghostResume) |
| AEGIS pause/resume integration | ✅ `lib/aegis/index.ts` (PARALLEL_BUILD + COUNCIL → ghostPause, all others → ghostResume) |
| watcher-bridge.test.ts | ✅ 19 tests (Tauri IPC mocked, AEGIS integration, resilience paths) |
| STATUS.md updated | ✅ Done |
| SPRINT_6A_COMPLETE.md written | ✅ Done |
| Conventional commit + push | ✅ Done |

### Sprint 6A Key Discoveries

- **notify v6 EventKind mapping**: `ModifyKind::Name(_)` covers renames (both old and new path events). `ModifyKind::Data(_)` covers content writes. `EventKind::Any` is used as fallback → `Modified`.
- **Custom debouncer required**: `notify-debouncer-full` only does idle-timeout debouncing. Dual-constraint 750ms idle + 1500ms max requires tracking `first_seen` per path in a `HashMap`. Background flush thread with 50ms tick, `Arc<AtomicBool>` stop flag in `Drop`.
- **Path component walking**: Checking only `path.file_name()` or the last segment allows `node_modules/deeply/nested/file.ts` to slip through. Must walk all components with `path.components()`.
- **Tauri state management**: `Mutex<GhostWatcherState>` registered via `.manage()` in `main.rs`. Commands receive `state: State<GhostState>` and call `state.lock().unwrap()`.
- **AEGIS→Ghost server/client boundary**: `invoke()` is a Tauri WebView (client-side) API. AEGIS runs server-side. Fixed by wrapping `ghostPause`/`ghostResume` in try-catch — silently no-op outside Tauri context, work correctly inside.
- **vi.fn generic syntax (vitest)**: `vi.fn<[ArgTuple], ReturnType>()` is a 2-arg generic form that vitest v4 doesn't support (0 or 1 arg expected). Use `vi.fn() as any` with `mockResolvedValue` chained. Pull captured callbacks via `mock.calls[0]?.[1]` not `mockImplementationOnce`.
- **TypeScript CFA + callbacks**: Assignments inside callback functions (`capturedCb = cb` in `mockImplementationOnce`) are not tracked by control flow analysis. TypeScript sees the variable as `null` at the call site. Pattern: use `mock.calls[0]?.[1]` to extract the captured argument after the call.
- **rustup no default toolchain**: Fresh Windows dev environments may have no default toolchain. Run `rustup default stable` before any `cargo` commands.
- **cmd shell required**: PowerShell doesn't support `&&` chaining. All shell commands with `&&` or `cargo`/`pnpm` must use `shell: "cmd"` in Desktop Commander.

## Sprint 6B Gate Results (COMPLETE — March 2, 2026)

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `pnpm test:run` | ✅ 603/603 passing (31 test files) |
| OAuth flow — local redirect server port 47832 | ✅ `lib/ghost/email/oauth.ts` |
| CSRF state nonce via `crypto.randomUUID()` | ✅ Enforced in `waitForAuthCode()` |
| Tokens in OS keychain (keytar) + AES-256-GCM fallback | ✅ `lib/ghost/email/keychain.ts` |
| Tokens never written to disk in plaintext | ✅ Vault fallback encrypts with machine key |
| Gmail `history.list` delta sync (not full scan) | ✅ `GmailConnector.poll()` — cursor in KERNL settings |
| Graph delta queries (not full mailbox scan) | ✅ `GraphConnector.poll()` — delta link in KERNL settings |
| HTML stripped from email bodies | ✅ Regex-based `stripHtml()` (no new dep) |
| `[UNTRUSTED CONTENT]` prefix on all body/attachment content | ✅ Enforced at connector layer |
| Attachments: text-based + under 10MB → content populated | ✅ `INDEXABLE_MIME_TYPES` + `ATTACHMENT_MAX_BYTES` |
| `ghost_email_state` table populated after first poll | ✅ `upsertEmailState()` in both connectors |
| 15-minute poller starts/stops | ✅ `startEmailPoller()` / `stopEmailPoller()` |
| AEGIS `PARALLEL_BUILD` / `COUNCIL` pauses poller | ✅ `isGhostPaused()` in `poller.ts` |
| 5 consecutive errors → Decision Gate surfaced | ✅ `logDecision()` via `surfaceCredentialGate()` |
| `noUncheckedIndexedAccess` compliance | ✅ `(arr[0] ?? '').trim()` pattern throughout |
| STATUS.md updated | ✅ Done |
| SPRINT_6B_COMPLETE.md written | ✅ Done |
| Conventional commit + push | ✅ Done |

## Sprint 6C Gate Results (COMPLETE — March 2, 2026)

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `pnpm test:run` | ✅ 603/603 passing (31 test files) |
| `schema.sql` — `source_path` + `source_account` columns | ✅ `ALTER TABLE content_chunks ADD COLUMN IF NOT EXISTS` |
| `ghost_indexed_items` audit table | ✅ Soft-delete column, indexed by `(source_type, indexed_at DESC)` |
| `app/lib/ghost/ingest/types.ts` | ✅ `IngestItem`, `ChunkResult`, `GhostChunkMetadata`, `IngestStats` |
| `app/lib/ghost/ingest/chunker.ts` | ✅ Code (600t, function-boundary, 50t overlap), doc (700t, para, 100t overlap), plain (600t, para, 100t overlap) |
| `app/lib/ghost/ingest/embedder.ts` | ✅ Batches of 10, 100ms inter-batch delay, dynamic import of `embedText()` |
| `app/lib/ghost/ingest/queue.ts` | ✅ `IngestQueue` — AEGIS-governed pause/resume, never-drop, 10k warning |
| `app/lib/ghost/ingest/writer.ts` | ✅ `writeChunks()` + `writeAuditRow()` via better-sqlite3 transaction |
| `app/lib/ghost/ingest/index.ts` | ✅ `ingestFile()`, `ingestEmail()`, `getIngestStats()`, `getQueueDepth()` |
| `findSimilarChunks()` ghost filter | ✅ `includeGhost: boolean = false` param — Ghost excluded from Cross-Context suggestions by default |
| Ghost metadata `source: 'ghost'` on all chunks | ✅ Written to `content_chunks.metadata` JSON |
| STATUS.md updated | ✅ Done |
| SPRINT_6C_COMPLETE.md written | ✅ Done |
| Conventional commit + push | ✅ Done |

### Sprint 6C Key Discoveries

- **`source_type` already existed in `content_chunks`**: Phase 3 Sprint 3A schema included `CHECK(source_type IN ('conversation','file','email','email_attachment'))` — the Ghost types were already allowed. Only `source_path` and `source_account` needed adding via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- **No migrations directory**: The project appends `ALTER TABLE` statements directly to `schema.sql` and runs them idempotently via `_db.exec(schema)` on every `getDatabase()` call. SQLite 3.37+ supports `ADD COLUMN IF NOT EXISTS`. This is the correct pattern for this codebase.
- **Ghost filter in `findSimilarChunks()`**: Ghost chunks sit in the same `vec_index` as Cross-Context chunks. The filter reads `content_chunks.metadata` JSON and checks `source === 'ghost'`. Malformed or null metadata is treated as non-ghost (safe default — never silently drops legitimate suggestions).
- **Circular import chain**: `ghost/ingest/embedder.ts` → `lib/embeddings/model.ts` would create a cycle if statically imported. Dynamic `import('@/lib/embeddings/model')` inside `embedBatch()` breaks the chain cleanly — same pattern used in `vector/index.ts` for `embed()`.
- **ONNX `embedText()` warm-up**: `_modelReady` flag in `embedder.ts` goes `true` on the first `embedBatch()` call. Before that, `getIngestStats().embeddingModelReady` returns `false` — accurate signal for the context panel status widget.

### Sprint 6B Key Discoveries

- **`@tauri-apps/plugin-shell` has no dev-environment types**: The shell plugin only resolves at Tauri runtime. `// @ts-expect-error` required on the dynamic import in `openInBrowser()`. The try-catch fallback to `child_process.exec` handles all non-Tauri environments (tests, dev server).
- **`noUncheckedIndexedAccess` + `Array.split`**: `str.split(';')[0]` returns `string | undefined` under this flag, even after a length guard. All MIME base extraction must use `(str.split(';')[0] ?? '').trim()`. This pattern appears in both `isEligibleAttachment()` and `fetchAttachment()` across both connectors.
- **Module-level variable narrowing**: TypeScript doesn't narrow `let x: T | null` assigned inside an `if` block when `x` is a module-level variable. `return x` after the assignment is still typed `T | null`. The `!` non-null assertion (`return x!`) is the correct fix — not restructuring into a local variable.
- **Array destructuring with `noUncheckedIndexedAccess`**: `const [a, b, c] = str.split(':')` gives `string | undefined` for all three even after a `length !== 3` guard. Must cast: `const [a, b, c] = str.split(':') as [string, string, string]`.
- **Graph delta `@removed` tombstones**: Delta query responses include deletion notifications where the item only has `@removed` + `id`. These must be filtered out before building `EmailMessage` objects — no tombstoning in the index.
- **Graph delta link persistence**: The delta link is a full URL that must be stored verbatim. Appending `$expand=attachments` to the delta link for subsequent polls requires checking if the expansion is already present to avoid double-appending.
- **Gmail `historyId` baseline**: `profiles.get()` returns a `historyId` representing the current state of the mailbox. Storing this on `connect()` means the first `poll()` only surfaces messages added *after* connect — correct behavior, no inbox flood.
- **keytar Windows DPAPI**: keytar wraps Windows DPAPI and requires native compilation via `node-gyp`. In environments where keytar fails to load, the KERNL vault fallback using `crypto.scryptSync` + AES-256-GCM with machine key (`os.hostname() + VAULT_SALT`) activates transparently.

## Sprint 6D Gate Results (COMPLETE — March 2, 2026)

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `pnpm test:run` | ✅ 640/640 passing (32 test files, 37 new) |
| `ghost_exclusions` table | ✅ `schema.sql` — type CHECK IN (path_glob/domain/sender/keyword/subject_contains) |
| `ghost_exclusion_log` audit table | ✅ `schema.sql` — logs every exclusion with layer, reason, pattern, source_type |
| `app/lib/ghost/privacy/types.ts` | ✅ `ExclusionResult`, `NOT_EXCLUDED`, `ExclusionType`, `GhostExclusion` |
| `app/lib/ghost/privacy/luhn.ts` | ✅ Standard Luhn + false-positive filters (all-same-digit, sequential run) |
| `app/lib/ghost/privacy/layer1.ts` | ✅ Path component walk + dotfile extension fix + content private-key headers |
| `app/lib/ghost/privacy/layer2.ts` | ✅ SSN (adjacent-char heuristic), CC (Luhn), API keys (7 patterns), JWT |
| `app/lib/ghost/privacy/layer3.ts` | ✅ Sensitive dir defaults + privileged email subject patterns |
| `app/lib/ghost/privacy/layer4.ts` | ✅ DB-backed user rules, 5-min cache, micromatch glob (micromatch 4.0.8) |
| `app/lib/ghost/privacy/index.ts` | ✅ `checkFilePath()`, `checkFileContent()`, `checkChunk()`, `checkEmail()`, `logExclusion()` |
| Ingest pipeline wired | ✅ `ghost/ingest/index.ts` — path check → content check → per-chunk L2 before embed |
| privacy.test.ts — 37 tests | ✅ All layers + Luhn covered |
| STATUS.md updated | ✅ Done |
| SPRINT_6D_COMPLETE.md written | ✅ Done |
| Conventional commit + push | ✅ Done |

## Sprint 6E Gate Results (COMPLETE — March 2, 2026)

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `pnpm test:run` | ✅ 677/677 passing (33 test files, 37 new) |
| `ghost_indexed_items.critical` column | ✅ `ALTER TABLE ... ADD COLUMN IF NOT EXISTS critical INTEGER DEFAULT 0` |
| `ghost_suggestion_feedback` table | ✅ action CHECK IN (dismissed/noted/expanded) |
| `ghost_surfaced` table | ✅ 24h rolling window, expires_at + dismissed_at |
| `app/lib/ghost/scorer/types.ts` | ✅ GhostCandidate, GhostSuggestion, ScorerConfig, DEFAULT_SCORER_CONFIG |
| `app/lib/ghost/scorer/context.ts` | ✅ buildActiveContextVector() → Float32Array or null (idle guard) |
| `app/lib/ghost/scorer/candidates.ts` | ✅ generateCandidates() — ghost-only filter, critical flag from DB |
| `app/lib/ghost/scorer/scorer.ts` | ✅ BLUEPRINT §6.4 formula: similarity × recency × relevance × (1-penalty) × importance |
| Recency boost | ✅ 1.0 ≤7d, linear decay to 0.5 at 90d, 0.5 beyond |
| Relevance boost | ✅ 1.2 if source path under active project (Windows backslash normalised) |
| Dismissal penalty | ✅ 0.2 × dismissals in last 30d, capped at 0.8 |
| `app/lib/ghost/scorer/window.ts` | ✅ canSurface(), recordSurfaced(), dismissSurfaced(), criticalOverride() |
| 24h cap | ✅ counts ALL surfaced (including dismissed) within windowMs |
| Critical override | ✅ bypasses cap when similarity > 0.95 AND importanceBoost > 1.3 |
| `app/lib/ghost/scorer/index.ts` | ✅ runScorer(), getActiveSuggestions(), dismissSuggestion(), startScorerSchedule() |
| Haiku summary | ✅ `claude-haiku-4-5-20251001`, `[UNTRUSTED CONTENT]` in system prompt, fails open |
| AEGIS pause guard | ✅ runScorer() no-ops on PARALLEL_BUILD / COUNCIL profiles |
| scorer.test.ts — 37 tests | ✅ All 37 new passing |
| STATUS.md updated | ✅ Done |
| SPRINT_6E_COMPLETE.md written | ✅ Done |
| Conventional commit + push | ✅ Done |

### Sprint 6E Key Discoveries

- **Vitest v4 class constructor mocks**: `vi.fn().mockImplementation(() => ({...}))` with an arrow function produces the warning "did not use 'function' or 'class'" and fails with `TypeError: ... is not a constructor` when called with `new`. Fix: use `vi.fn().mockImplementation(function() { return {...}; })` (regular function, not arrow) or a class literal. Arrow functions cannot be `new`-ed.
- **mockReturnValueOnce queue bleed**: `mockReturnValueOnce` queues persist across tests unless explicitly cleared. A test that sets up two queued values but only consumes one (e.g., returns null early) leaves a stale value that poisons the next test's first DB call. Fix: `beforeEach(() => { mockGet.mockReset(); mockAll.mockReset(); ... })` — reset only the DB mocks, not the module-level `vi.mock()` implementations.
- **vi.resetAllMocks() too aggressive**: `vi.resetAllMocks()` clears all mock implementations — including `getDatabase()`, `getLatestAegisSignal()`, and other module-level mocks. These go from returning default values to returning `undefined`, causing `Cannot read properties of undefined (reading 'prepare')`. Use per-mock `.mockReset()` targeted at only the mocks that can have queue bleed.
- **Dynamic import mocking**: `await import('@/lib/embeddings/model')` inside `buildActiveContextVector()` is intercepted by `vi.mock('@/lib/embeddings/model', ...)` even though it's a dynamic import. Vitest hoists all `vi.mock()` calls before module evaluation — both static and dynamic imports from the same path get the mock.
- **context.ts null path**: Returns null when (a) no thread has any messages (idle session) or (b) the most recent thread has no *assistant* messages. Tests for these paths must not leave unconsumed `mockReturnValueOnce` values in the queue — they bleed into the next test's thread query.

## Sprint 6F Gate Results (COMPLETE — March 2, 2026)

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `pnpm test:run` | ✅ 703/703 passing (34 test files, 26 new lifecycle tests) |
| `app/lib/ghost/ipc.ts` | ✅ Node.js EventEmitter + Tauri emit_all best-effort |
| `app/lib/ghost/status.ts` | ✅ GhostStatus type, singleton, updateGhostStatus(), addGhostStatusError() |
| `app/lib/ghost/lifecycle.ts` | ✅ 7-step startup, reverse shutdown with 5s hard timeout, degraded mode |
| `app/lib/ghost/index.ts` | ✅ Public barrel: startGhost, stopGhost, pauseGhost, resumeGhost, getGhostStatus |
| `app/lib/stores/ghost-store.ts` | ✅ Zustand store: ghostStatus, ghostSuggestions + actions |
| `app/lib/stores/index.ts` | ✅ useGhostStore exported |
| `app/lib/aegis/index.ts` | ✅ switchProfile() calls pauseGhost()/resumeGhost() alongside ghostPause()/ghostResume() |
| `app/lib/ghost/email/poller.ts` | ✅ pauseEmailPoller()/resumeEmailPoller() added (_explicitPause flag) |
| `app/lib/ghost/ingest/index.ts` | ✅ pauseIngestQueue()/resumeIngestQueue() exported |
| Component restart | ✅ restartComponent() — 30s delay, single retry, exhausted set |
| Degraded mode | ✅ any startup step failure → errors[] populated, state: 'degraded' |
| AEGIS propagation | ✅ PARALLEL_BUILD/COUNCIL → pauseGhost(); other profiles → resumeGhost() |
| Shutdown timeout | ✅ 5s hard timeout via Promise.race() |
| lifecycle.test.ts — 26 tests | ✅ startup order, shutdown order, degraded, pause/resume, restart |
| STATUS.md updated | ✅ Done |
| SPRINT_6F_COMPLETE.md written | ✅ Done |
| Conventional commit + push | ✅ Done |

### Sprint 6F Key Discoveries

- **vi.resetModules() test pattern for module-level state**: lifecycle.ts has `_started` and `_paused` booleans that persist between tests in the same file. Solution: wrap each test group with `await freshLifecycle()` which calls `vi.resetModules()` then dynamic `await import('../lifecycle')` — each test gets a fresh module with zeroed state.
- **getUserExclusions() is the cache-priming entry point**: `loadExclusions()` in `layer4.ts` is a private (non-exported) function. The public `getUserExclusions()` calls it internally and populates the 5-min cache. Lifecycle step 3 correctly calls the public function.
- **Explicit vs AEGIS-signal pause**: email poller and ingest queue each have two independent pause mechanisms. AEGIS-signal pause (already present in 6A–6C) reads `getLatestAegisSignal()` on each poll tick. Explicit pause (6F) sets a module-level `_explicitPause` / `_paused` flag that short-circuits before the AEGIS check. Both must coexist cleanly.
- **Promise.race() shutdown pattern**: `await Promise.race([shutdown(), setTimeout(5000)])` is the canonical 5s timeout. Individual component stop errors are caught inside `shutdown()` and logged as warnings — they do not abort the remaining shutdown steps.
- **IPC architecture**: In Tauri, `emit_all()` broadcasts to WebView windows. In the Next.js server process (Node.js), a module-level `EventEmitter` handles server-side listeners. The `emit()` helper in `ipc.ts` fires both — Node.js synchronously, Tauri async via dynamic import (no-op outside Tauri).

### Sprint 6D Key Discoveries

- **Dotfile extension trap**: `path.parse('/project/.env')` returns `{ name: '.env', ext: '' }` — Node treats dotfiles as having an empty extension. The extension check must also test `parsed.base.toLowerCase()` directly against the exclusion set to catch `.env`, `.pem`, etc.
- **SSN heuristic over-reach**: Checking for any letter within 3 chars of the match caused `isLikelySSN()` to return `false` for `"SSN: 123-45-6789"` (the `N` in `SSN` is only 2 chars away). Reduced to 1-char adjacency check — only immediately touching letters suppress the match. `\b` word boundary in the regex handles true identifier false-positives.
- **noUncheckedIndexedAccess + char access**: `text[i]` returns `string | undefined` under strict index checks. Array index access inside `isLikelySSN` required `(text[idx] ?? '')` wrapping even for single-char reads.
- **micromatch as new dep**: Not already present. Added `micromatch@4.0.8` + `@types/micromatch` — zero-dependency glob matcher, ~15KB, correct choice for Layer 4 path_glob matching.
- **Layer 4 cache invalidation**: 5-minute TTL stored as `_cacheTs` module variable. No explicit invalidation API needed — Privacy Dashboard (Sprint 6G) will call `removeExclusion()` which already clears the cache via `_cacheTs = 0`.

## ✅ PHASE 6 COMPLETE — Ghost Thread

## Queued: Phase 6 — Ghost Thread (after Phase 5 complete)

Execution order: 6A -> 6B -> 6C -> 6D -> 6E -> 6F -> 6G -> 6H -> 6I (all sequential)

- [x] **SPRINT 6A** — Rust filesystem watcher (notify v6, 750ms/1500ms debounce, exclusions in Rust, Tauri IPC) — **COMPLETE**
- [x] **SPRINT 6B** — Gmail + Outlook OAuth connectors, delta sync, keychain, 15-min AEGIS-governed poller — **COMPLETE**
- [x] **SPRINT 6C** — Unified ingest pipeline: type-aware chunker, batch embedder, AEGIS queue, ghost_indexed_items audit — **COMPLETE**
- [x] **SPRINT 6D** — Privacy exclusion engine (4 layers: hard-coded, PII scanner, contextual, user rules) — **COMPLETE**
- [x] **SPRINT 6E** — Interrupt scoring engine (6h cadence, BLUEPRINT §6.4 formula, 24h rolling cap, Haiku summaries) — **COMPLETE**
- [x] **SPRINT 6F** — Ghost process lifecycle + IPC (7-step startup, 5s shutdown, AEGIS propagation, component restart, Zustand store) — **COMPLETE**
- [x] **SPRINT 6G** — Privacy Dashboard UI (6 API routes, 8 React components, cascade delete, exclusion log retention cap, deleteGhostItem(), purge-all with Ghost restart) — **COMPLETE**
- [x] **SPRINT 6H** — Ghost context panel cards (GhostCard, GhostCardList, GhostCardActions, Tell me more injection, Noted feedback, 4h auto-expire on render, Tauri event listener, Ghost context active indicator, activeThreadId bridge via ghost store) — **COMPLETE**
- [x] **SPRINT 6I** — Integration + Phase 6 certification: 33-test integration suite, [UNTRUSTED CONTENT] boundary verified, EoS 82/100, performance measurements, BLUEPRINT updated — **COMPLETE**

## Phase 6 Source Notes

No external project to migrate. Phase 6 is greenfield.
Ghost shares: content_chunks table, vec_index, bge-small-en-v1.5 embedding model (all from Phase 3).
Ghost does NOT share: suggestion surfacing logic (has its own interrupt scorer).
Critical security requirement: [UNTRUSTED CONTENT] label on every path Ghost content enters Claude API.

## Open Questions

None.

## Blueprint Files

| File | Description |
|---|---|
| BLUEPRINT_FINAL.md | Complete integrated blueprint v1.1.0 |
| BLUEPRINT_S5_CrossContext.md | §5 detail — Cross-Context Engine |
| BLUEPRINT_S6_Ghost.md | §6 detail — Ghost Thread |
| BLUEPRINT_S7_AgentSDK_SelfEvolution.md | §4.3 + §7 detail |
| DEV_PROTOCOLS.md | Dev protocol reference |
| PROJECT_DNA.yaml | Project identity and constraints |
| HANDOFF.md | Original pre-Council context handoff |
