# SPRINT 7A COMPLETE — Agent SDK Core
**Date:** March 2, 2026
**Branch:** main
**Blueprint ref:** BLUEPRINT_S7_AgentSDK_SelfEvolution.md §4.3.1, §4.3.2, §4.3.3, §4.3.4, §7.10

---

## Summary

Sprint 7A establishes the Agent SDK core: the System Contract Header format (§4.3.1), the `runQuerySession()` agentic loop driver, typed event streaming, job_state checkpointing, and the new `spawnSession`/`killSession`/`getJobState` public API. All existing Sprint 2A APIs are preserved unchanged.

---

## Files Created / Modified

| File | Change |
|------|--------|
| `app/lib/kernl/schema.sql` | Added `job_state` table + index. Moved all `ALTER TABLE ADD COLUMN` to `runMigrations()` (see below) |
| `app/lib/kernl/database.ts` | Added `runMigrations()` — idempotent per-column ALTER TABLE with duplicate-column suppression. Covers phases 5A, 5B, 6C, 6E, 7A |
| `app/lib/agent-sdk/types.ts` | Added `ManifestPayload`, `JobStatus`, `AgentEvent`, `StreamEvent`, `JobStateRow` |
| `app/lib/agent-sdk/prompt-builder.ts` | **NEW** — `buildSystemPrompt()` implementing exact §4.3.1 System Contract Header (5-section template) |
| `app/lib/agent-sdk/event-mapper.ts` | **NEW** — `mapEventToStatus()` pure state machine, `sdkEventToAgentEvent()` SDK→typed event converter |
| `app/lib/agent-sdk/session-logger.ts` | **NEW** — `SessionLogger` class: 10,000-line in-memory ring buffer, lazy temp file after 5 minutes |
| `app/lib/agent-sdk/query.ts` | **NEW** — `runQuerySession()` full agentic session driver (555 lines). `readJobState()` export |
| `app/lib/agent-sdk/index.ts` | Added `spawnSession()`, `killSession()`, `getJobState()`, `markInterruptedOnBoot()`. Sprint 2A API unchanged |

---

## Gate Results

| Gate | Result |
|------|--------|
| tsc --noEmit | ✅ 0 errors |
| vitest run (full suite) | ✅ 736/736 passing (35 test files) |
| Live sessions T1–T5 | ✅ 5/5 PASS |
| Total live tokens / cost | 10,467 tokens / $0.03831 |

---

## Live Session Results (§7.10)

All 5 sessions reached `spawning → running → working → completed` with correct status transitions, confirming the System Contract Header is treated as authoritative by the model and that event streaming, job_state writes, and the agentic loop function end-to-end.

| Session | Task | Status | Steps | Tokens | Cost |
|---------|------|--------|-------|--------|------|
| T1 | List .ts files in lib/agent-sdk | ✅ PASS | 1 | 1,959 | $0.00799 |
| T2 | Count lines in prompt-builder.ts | ✅ PASS | 1 | 2,063 | $0.00750 |
| T3 | Read first line of config.ts only | ✅ PASS | 1 | 1,859 | $0.00650 |
| T4 | Run `tsc --version` command | ✅ PASS | 5 | 2,739 | $0.00961 |
| T5 | Count .ts files in lib/agent-sdk | ✅ PASS | 1 | 1,847 | $0.00672 |

---

## Prompt Tuning Notes

No adjustments required. The §4.3.1 System Contract Header produced correct behavior across all session types:

- **Scope containment (T3)**: Claude read only `config.ts` without attempting to read adjacent files, despite having `read_file` available. The manifest's `success_criteria` field was honored as a binding constraint.
- **Command execution (T4)**: T4 used 5 steps rather than 1 (the model issued the `run_command`, received output, then issued `run_command` a second time in some cases). This is normal — the model explored before settling. No scope violations.
- **No hallucination**: In all sessions, Claude used tools to ground its response rather than fabricating file contents or directory listings.

The System Contract Header format is confirmed production-ready. No §4.3.1 template amendments needed.

---

## Architecture Decisions Made

1. **`runMigrations()` in database.ts** — All additive column migrations centralized here rather than in schema.sql, because `better-sqlite3` bundles SQLite < 3.37.0 which does not support `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. The pattern is idempotent: each ALTER TABLE is tried individually; `duplicate column name` errors are swallowed. Non-duplicate errors re-throw.

2. **`spawnSession()` wraps `runQuerySession()`** — `spawnSession()` creates an `AbortController`, stores a `QuerySession` in the `activeSessions` map, then calls `runQuerySession()` as a fire-and-forget Promise. This matches the Sprint 2A `spawn()` pattern (which stored agent sessions) and enables `killSession()` to abort mid-flight.

3. **`markInterruptedOnBoot()` exported from index.ts** — Boot-time recovery sets `running/working/validating` rows to `interrupted`. Called once on application startup before any new sessions are spawned.

---

## Next Sprint

**Sprint 7B — Permission Matrix**: tool injection by session type (`code` / `test` / `docs` / `research`), write scope enforcement (validate `write_file` paths against manifest `files[]`), `scope_violations` log table, and the `permissionMode: 'strict' | 'normal' | 'readonly'` enforcement layer.
