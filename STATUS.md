# GREGORE LITE — STATUS
**Last Updated:** March 2, 2026 — Sprint 5A COMPLETE  
**Phase:** Phase 5 — Quality Layer (SHIM + Eye of Sauron)

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
- [ ] **SPRINT 5B** — SHIM PatternLearner migration + FP feedback UI (dismiss button, `/api/eos/fp`, quality section in context panel)
- [ ] **SPRINT 5C** — Integration hardening, self-scan, PatternLearner seeding, War Room badge, Phase 5 certification

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
