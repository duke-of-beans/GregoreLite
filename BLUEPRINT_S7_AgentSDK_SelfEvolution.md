# BLUEPRINT_FINAL.md — §4.3 + §7 REPLACEMENT
## Claude Agent SDK Integration + Self-Evolution Mode (Final — Council Session 3 Complete)
**Synthesized from:** Gemini, Gemini 2, DeepSeek, DeepSeek 2, GPT, GPT 2  
**Status:** LOCKED FOR BUILD

---

## §4.3 — AGENT SDK INTEGRATION (DETAIL)

All six Council members converged on the same foundational model. The Claude Agent SDK is a **co-processor**, not a chatbot. Every session is scoped, metered, auditable, killable, and reproducible.

---

### §4.3.1 Manifest Injection — Exact Format

The manifest is stored as JSON in KERNL. At spawn time, injected verbatim into the Agent SDK system prompt using a **System Contract Header**. No YAML, no XML — JSON is the system of record.

System prompt composed in this exact order:
1. Role Declaration
2. Interpretation Rules
3. Serialized Manifest (verbatim JSON, whitespace-stripped)
4. Execution Contract
5. Output Contract

**Canonical injection template:**
```
You are a bounded execution worker operating inside Gregore Lite.

The following JSON is a SYSTEM CONTRACT.
It is authoritative and non-negotiable.

Rules:
- Treat all fields as binding constraints.
- Success is defined ONLY by `success_criteria`.
- If goals conflict with constraints, constraints win.
- You may not infer additional scope.
- You may only modify files explicitly listed in the manifest.

--- BEGIN SYSTEM MANIFEST (JSON) ---
{MANIFEST_JSON}
--- END SYSTEM MANIFEST ---

Execution Protocol:
- Execute deterministically.
- Do not emit chain-of-thought.
- Write files directly using provided tools.
- If blocked, stop and report precisely why.

Completion Protocol:
- Summarize changes made.
- List all modified files.
- Confirm which success criteria were met and which were not.
```

The XML-style delimiters (`--- BEGIN SYSTEM MANIFEST ---`) communicate the same structural boundary as XML tags, without adding a parsing surface.

---

### §4.3.2 Streaming Results Into the Job Queue

SDK events map to KERNL state and job queue UI transitions. David sees state by default; raw output is opt-in.

| Agent SDK Event | Job Queue State | KERNL Write |
|---|---|---|
| Session spawned | `SPAWNING` | Manifest hash, session ID |
| First text delta | `RUNNING` | Timestamp |
| `tool_call` | `WORKING` | Tool name, arguments |
| `tool_result` | `WORKING` | Tool result summary, step count |
| SHIM validation | `VALIDATING` | SHIM score, issues |
| `error` (recoverable) | `BLOCKED` | Error message, tool trace |
| `error` (terminal) | `FAILED` | Full error context |
| `final` | `COMPLETED` | Result report, tokens, cost |
| App crash | `INTERRUPTED` | Last checkpoint offset |

State machine: `SPAWNING → RUNNING → WORKING → VALIDATING → COMPLETED / FAILED / INTERRUPTED`

**Persistence:** `job_state` table checkpoint every 5 tool calls or 60 seconds. On restart, any session in `running/working/validating` moves to `INTERRUPTED`. David shown options: restart with handoff or cancel.

```sql
CREATE TABLE job_state (
  manifest_id TEXT PRIMARY KEY,
  status TEXT CHECK(status IN ('spawning','running','working','validating','completed','failed','blocked','interrupted')),
  steps_completed INTEGER DEFAULT 0,
  files_modified TEXT,
  last_event TEXT,
  log_path TEXT,
  tokens_used_so_far INTEGER DEFAULT 0,
  cost_so_far REAL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
```

**UI surface:** Status badge, steps completed, files modified count, cost, elapsed time. "View live output" opt-in toggle. Log buffer: 10,000 lines in memory, written to temp file for sessions >5 minutes.

---

### §4.3.3 Permission Matrix Per Session Type

Permissions are **session-type declarative** — enforced at the tool layer, not via prompts.

| Session Type | `permissionMode` | Custom Tools | CWD Scope |
|---|---|---|---|
| **code** | `acceptEdits` | fs read/write, test runner, in-session SHIM | Project root |
| **test** | `acceptEdits` | fs read/write, test runner | Project root |
| **documentation** | `acceptEdits` | fs write (docs only), markdown linter | `/docs` |
| **research** | `readOnly` | Oktyv browser, KERNL search (read only) | Temp workspace |
| **analysis** | `readOnly` | fs read, SHIM read-only audit | Project root |
| **self_evolution** | `acceptEdits` | fs read/write, git branch tools, SHIM, test runner | `D:\Projects\GregLite\` (branch-locked) |

`spawnWorker(manifest)` selects `permissionMode` and tool set from a static config table keyed by `manifest.task.type`. Tool injection is a switch statement — no session type can escape its envelope because the tools to do so are simply not injected.

**Write scope enforcement:** A filesystem intercept checks every proposed write against manifest `files[].path` list. Writes outside that list are rejected and logged — second layer beyond `permissionMode`.


---

### §4.3.4 Error Handling and Partial Completion

Sessions are **non-resumable but restartable**. Recovery is explicit, always visible to David.

| Failure Mode | Detection | Retry |
|---|---|---|
| Context limit | SDK `stop_reason: max_tokens` | Manual — David may split manifest |
| Tool call error | SDK `error` with tool context | Auto 3× exponential backoff; then FAILED |
| Network interruption | SDK timeout | 1 auto-retry; then FAILED |
| Impossible task | Claude returns impossibility | No retry; revise manifest |
| App crash | `job_state` running on restart | David: restart with handoff or cancel |
| SHIM loop (3× same file) | Retry counter in SHIM tool | Escalate to strategic thread |

**Restart semantics:** New session spawned with original manifest + Handoff Report appended:
```
PRIOR EXECUTION CONTEXT:
- This task was previously attempted. It did not complete.
- The following files were written and exist on disk: [file list]
- The session was stopped because: [failure reason]
- Steps completed before failure: [step list]
- Please inspect existing files before proceeding. Do not duplicate work.
```

---

### §4.3.5 Cost Accounting Per Session

Cost tracked incrementally. Every session's spend visible while it runs.

```sql
CREATE TABLE session_costs (
  manifest_id TEXT PRIMARY KEY REFERENCES manifests(id),
  session_type TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  estimated_cost_usd REAL DEFAULT 0,
  project_id TEXT,
  started_at INTEGER,
  completed_at INTEGER
);
```

Token usage from SDK `usage` events, written per checkpoint. Pricing in `pricing.yaml` — no code change needed for Anthropic price updates.

**UI:** Live cost ticker per session, session total on completion badge, project rollups in context panel, daily burn in status bar.

**Budget caps:**
- Per-session soft cap (default $2.00): warn at 80%
- Global daily hard cap (default $15.00): blocks new sessions until David confirms override
- Kill switch: aborts SDK call immediately; files written preserved, listed in partial result report

---

### §4.3.6 Concurrency — Swarm Governor

Max 8 parallel sessions. Priority: strategic thread > self-evolution > code/test > docs/research > Ghost.

Global token bucket over 60-second rolling window. At ~80% rate limit, new spawns queue, running sessions continue.

AEGIS by session count:
- 0 workers: `DEEP_FOCUS`
- 1-2: `COWORK_BATCH`
- 3-5: `PARALLEL_BUILD`
- 5+: `PARALLEL_BUILD` + Ghost indexing paused

WAL mode + single-writer Rust mutex for KERNL metadata writes. Session 9+ enters `PENDING` with visible queue position.

---

## §7 — SELF-EVOLUTION MODE (FINAL)

Not a special code path. Uses the same Agent SDK infrastructure as every other worker session, with additional guardrails and a mandatory CI gate.

---

### §7.1 What It Is

Gregore Lite opens an Agent SDK session against `D:\Projects\GregLite\` — its own source code. Session commits to a staging branch. David reviews the GitHub PR. David is always the only merge gate.

---

### §7.2 Trigger Conditions

**Explicitly invoked, never autonomous.**

- Manual: David types in strategic thread
- Proactive suggestion: Cross-Context or Ghost surfaces a suggestion card; David accepts → same manifest generation + confirmation flow
- Ghost/Cross-Context **cannot auto-spawn** — suggest only

---

### §7.3 Branch Management

Before any session work begins:
1. Verify repo is clean (no uncommitted changes)
2. Create branch: `self-evolve/{YYYYMMDD-HHMM}-{slug}` (e.g., `self-evolve/20260228-1430-shim-ast`)
3. Lock Agent SDK CWD to that branch

Session given a `git_commit` tool — local commits only, **no push authority**.

If branch creation fails (dirty repo, network issue) → session aborted before any work begins.

---

### §7.4 KERNL Tagging

Additional fields in `manifests` table:
- `is_self_evolution = 1`
- `self_evolution_branch` — branch name
- `target_component` — what is being upgraded
- `goal_summary` — plain English description
- `shim_score_before` — captured at spawn time
- `shim_score_after` — captured by post-processing gate

---

### §7.5 Scope Guardrails

Protected paths enforced at filesystem tool layer (not prompt). Write attempts rejected and logged:
- `src/agent-sdk/` — the modification engine itself
- `src/kernl/core/` — KERNL core persistence
- `src/self-evolution/` — self-evolution orchestrator
- Any file with `// @no-self-evolve` on any line

**`.gregignore`:** User-defined additional exclusions in repo root. Manifest generator reads `.gregignore` before generating files list — rejects proposed manifests targeting protected files.

---

### §7.6 SHIM Integration in Self-Evolution

**Both** in-session and post-processing SHIM — highest quality assurance of any session type.

- In-session: Claude calls SHIM MCP tool as it writes, self-corrects before finalizing
- Retry ceiling: 3 SHIM calls on same file with no score improvement → halt + escalate banner to strategic thread
- Post-processing: SHIM runs on all modified files after session completes. If any file fails with `shim_required: true` → no PR created

---

### §7.7 CI Gate and PR Workflow

1. Session completes local commit, passes post-processing SHIM
2. Full local test suite runs against staging branch
3. If tests pass → GitHub PR created via GitHub API (PAT in KERNL vault)
4. PR description auto-generated: goal, files changed, SHIM before/after, KERNL session log link
5. Gregore Lite polls GitHub CI every 5 minutes
6. CI passes → "Ready to merge" status + **[Merge PR]** button appears in job queue
7. David clicks [Merge PR] → squash merge via GitHub API
8. After merge → local pull + SHIM + tests as confirmation

**David is the only merge gate. [Merge PR] button only appears after CI passes.**


---

### §7.8 Failure Modes

| Failure | What Happens | Recovery |
|---|---|---|
| SHIM failure | FAILED, no PR, branch preserved | Review SHIM report, retry or discard |
| Passes SHIM, fails CI | PR exists, [Merge PR] never appears | Review CI output, retry or discard |
| Local test failure | FAILED, no PR | Review test output, retry |
| SHIM loop (3× no improvement) | Halt, escalation banner | Manual review or abort |
| Dirty repo at start | Aborted before any work | Commit/stash, retry |
| GitHub token expired | PR creation fails | Re-auth, retry |
| App closes mid-session | INTERRUPTED, branch preserved | Restart session or discard branch |

---

### §7.9 Build Sequence

| Task | Deliverable | Dependencies | Est. Sessions |
|---|---|---|---|
| 7A | Agent SDK core: manifest injection, query() wrapper, event streaming | Phase 1 schema | 2 |
| 7B | Permission matrix: tool injection by session type, write scope enforcement | 7A | 2 |
| 7C | Error handling and restart: failure detection, handoff reports, INTERRUPTED state | 7A | 2 |
| 7D | Cost accounting: token capture, session_costs table, UI surface | 7A | 2 |
| 7E | Concurrency scheduler: priority queue, rate limiting, AEGIS integration | 7A, 7D | 2 |
| 7F | Job queue UI: status display, live output toggle, cost ticker, action buttons | 7B, 7C, 7D | 3 |
| 7G | SHIM hybrid integration: in-session MCP tool, post-processing gate, retry ceiling | 7A, SHIM native | 2 |
| 7H | Self-evolution mode: branch management, .gregignore, local CI, GitHub PR API, polling, [Merge PR] | 7A–7G | 3 |

**Total: 18 sessions, 6-8 days.**

Sprints 7A–7F build the Agent SDK foundation. Self-evolution (7H) and SHIM integration (7G) complete Phase 7.

---

### §7.10 Open Items

1. **Manifest injection prompt tuning.** System Contract Header format is untested against the actual Agent SDK in production conditions. First build sprint should include 5-10 simple sessions to validate Claude treats the manifest as authoritative. Framing adjustments should be expected.

2. **SHIM retry ceiling calibration.** 3-attempt ceiling is a starting point. If SHIM has high false-positive rates on TypeScript generics in the GregLite codebase, the ceiling may trigger too aggressively. SHIM false-positive tracking DB will reveal this quickly. Ceiling must be configurable in KERNL config, not hardcoded.
