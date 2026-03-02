GREGLITE SPRINT 7A - Agent SDK Core: Manifest Injection, query() Wrapper, Event Streaming
Phase 7, Sprint 1 of 8 | Foundation for all of Phase 7 | March 2026

YOUR ROLE: Build the Agent SDK core layer. This is the engine everything in Phase 7 runs on. Manifest injection into the System Contract Header format, the query() wrapper that drives a session from start to finish, and event streaming that writes every SDK event into KERNL job_state. Every subsequent sprint (7B through 7H) depends on this. David is CEO. Zero debt, complete implementation.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Dev\CLAUDE_INSTRUCTIONS.md
2. D:\Dev\TECHNICAL_STANDARDS.md
3. D:\Dev\SUBAGENT_ROUTING_PROTOCOL.md
4. D:\Projects\GregLite\DEV_PROTOCOLS.md
5. D:\Projects\GregLite\STATUS.md
6. D:\Projects\GregLite\BLUEPRINT_FINAL.md - §3.1 (schema), §4.3.1 (manifest injection), §4.3.2 (event streaming)
7. D:\Projects\GregLite\BLUEPRINT_S7_AgentSDK_SelfEvolution.md - fully
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL - STOP WHEN:
- The Anthropic Agent SDK API surface differs from what the blueprint assumes - read the actual SDK docs before writing query()
- The manifests table schema in the live DB has columns that conflict with job_state additions - inspect before migrating
- System Contract Header prompt produces unexpected Claude behavior in test runs - flag before continuing, §7.10 warns this may need tuning
- Sonnet has failed on the same problem twice → spawn Opus subagent
- Same fix 3+ times

SUBAGENT ROUTING:
[HAIKU] KERNL migration: CREATE job_state table → DDL fully specified below, mechanical
[HAIKU] KERNL migration: ALTER manifests table to add target_component, goal_summary, shim_score_before, shim_score_after → DDL specified, use PRAGMA table_info first, mechanical
[HAIKU] Write types.ts (ManifestPayload, AgentEvent, JobStatus, StreamEvent) → shapes fully specified, mechanical
[HAIKU] Write prompt-builder.ts (buildSystemPrompt) → template fully specified, string interpolation only, mechanical
[HAIKU] Run npx tsc --noEmit + capture errors → mechanical
[HAIKU] SESSION END: Update STATUS.md sprint 7A complete, write SPRINT_7A_COMPLETE.md, git commit message to .git\COMMIT_MSG_TEMP, git add/commit -F/push
[SONNET] query.ts: full Agent SDK session driver - spawn, stream events, write job_state checkpoints, handle terminal states
[SONNET] event-mapper.ts: map raw SDK events to JobStatus transitions per §4.3.2 state machine
[SONNET] session-logger.ts: 10,000-line in-memory ring buffer, temp file flush for sessions >5 min
[SONNET] index.ts: public API - spawnSession(manifest), killSession(manifestId), getJobState(manifestId)
[SONNET] 5-10 live test sessions against real Agent SDK to validate System Contract Header prompt
[OPUS] Escalation only if Sonnet fails twice on same problem - particularly if System Contract Header framing requires architectural rethink

QUALITY GATES:
1. System Contract Header prompt produced in exact order: Role Declaration → Interpretation Rules → Manifest JSON → Execution Contract → Output Contract
2. Every SDK event mapped to correct JobStatus transition per §4.3.2 table
3. job_state checkpointed every 5 tool calls AND every 60 seconds
4. On app restart, any job_state row in running/working/validating → set to INTERRUPTED
5. killSession() aborts the SDK call immediately, preserves files written, writes partial result report
6. 5 live test sessions complete without hanging or unhandled promise rejections
7. pnpm test:run zero failures

FILE LOCATIONS:
  app/lib/agent-sdk/
    index.ts             - public API: spawnSession(), killSession(), getJobState()
    query.ts             - Agent SDK session driver, event streaming loop
    event-mapper.ts      - SDK event → JobStatus state machine
    prompt-builder.ts    - buildSystemPrompt(manifest) → System Contract Header string
    session-logger.ts    - ring buffer + temp file flush
    types.ts             - ManifestPayload, AgentEvent, JobStatus, StreamEvent interfaces

SYSTEM CONTRACT HEADER - exact template (from §4.3.1):
  "You are a bounded execution worker operating inside Gregore Lite.

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
  - Confirm which success criteria were met and which were not."

MANIFEST_JSON is JSON.stringify(manifest) with no whitespace. The manifest object is the full row from the manifests table plus the files[] and success_criteria[] arrays.

JOB_STATE TABLE (KERNL migration):
  CREATE TABLE IF NOT EXISTS job_state (
    manifest_id TEXT PRIMARY KEY,
    status TEXT CHECK(status IN ('spawning','running','working','validating','completed','failed','blocked','interrupted')),
    steps_completed INTEGER DEFAULT 0,
    files_modified TEXT,       -- JSON array of paths
    last_event TEXT,           -- JSON of last SDK event for debugging
    log_path TEXT,             -- temp file path if session >5 min
    tokens_used_so_far INTEGER DEFAULT 0,
    cost_so_far REAL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );

MANIFESTS TABLE ADDITIONS (only if columns not present - check PRAGMA table_info first):
  ALTER TABLE manifests ADD COLUMN target_component TEXT;
  ALTER TABLE manifests ADD COLUMN goal_summary TEXT;
  ALTER TABLE manifests ADD COLUMN shim_score_before REAL;
  ALTER TABLE manifests ADD COLUMN shim_score_after REAL;

EVENT → JOBSTATUS STATE MACHINE (from §4.3.2):
  Session spawned         → SPAWNING  (write manifest_hash, session_id to job_state)
  First text delta        → RUNNING   (write timestamp)
  tool_call               → WORKING   (write tool name, args summary)
  tool_result             → WORKING   (write result summary, increment steps_completed)
  SHIM validation event   → VALIDATING (write shim score, issues)
  error (recoverable)     → BLOCKED   (write error message, tool trace)
  error (terminal)        → FAILED    (write full error context)
  final                   → COMPLETED (write result report, total tokens, cost)
  App restart w/ running  → INTERRUPTED (set on bootstrap, before any new session work)

CHECKPOINT LOGIC:
Write job_state to KERNL every 5 tool_call events OR every 60 seconds, whichever comes first. Use a step counter and a timestamp. Do not write on every single event — that is too expensive.

RESTART DETECTION:
On app startup (in the bootstrap sequence), query job_state WHERE status IN ('spawning','running','working','validating'). For each: set status = 'interrupted', updated_at = now(). These sessions will be surfaced to David in the job queue UI (Sprint 7F) as requiring action.

KILL SWITCH:
killSession(manifestId) must:
1. Abort the in-flight SDK stream immediately (close the connection / reject the promise)
2. Write job_state status = 'failed', last_event = 'killed by user'
3. Produce a partial result report listing files already written to disk
4. Never block - return immediately, cleanup async

SESSION LOGGER:
Ring buffer: hold last 10,000 lines of raw SDK output in memory (array, oldest evicted). For sessions running longer than 5 minutes, also stream to a temp file at os.tmpdir()/greglite-session-{manifestId}.log. Store the temp file path in job_state.log_path.

LIVE TEST REQUIREMENT (§7.10 open item):
Before closing sprint 7A, run 5-10 simple Agent SDK sessions using the System Contract Header format. Simple tasks: "read this file and return its line count", "list files in this directory". Validate that Claude treats the manifest as authoritative and does not hallucinate scope beyond what is specified. Document any prompt adjustments needed in SPRINT_7A_COMPLETE.md under "Prompt Tuning Notes". This is the only sprint where prompt tuning is expected — do not defer it.

PRICING:
Read pricing from app/lib/services/pricing.ts (already exists from Phase 0 scaffold). Use input/output token counts from SDK usage events. Do not hardcode prices.

SESSION END:
1. npx tsc --noEmit - zero errors
2. pnpm test:run - zero failures
3. Update STATUS.md - Sprint 7A complete
4. git commit -F .git\COMMIT_MSG_TEMP (message: sprint-7a: Agent SDK core, manifest injection, event streaming, job_state)
5. git push
6. Write SPRINT_7A_COMPLETE.md: live test results (5-10 sessions), prompt tuning notes, any System Contract Header adjustments made, checkpoint timing verified

GATES CHECKLIST:
- buildSystemPrompt() produces header in exact §4.3.1 order
- Manifest JSON is whitespace-stripped in the header
- Every SDK event type produces correct JobStatus transition
- job_state row exists and is correct after each test session
- Checkpoint writes every 5 tool calls and every 60 seconds
- On simulated restart: running sessions → INTERRUPTED
- killSession() returns immediately, session log shows killed event
- Ring buffer holds 10,000 lines, temp file created after 5 min
- 5+ live test sessions complete successfully
- Prompt tuning notes documented
- pnpm test:run clean
- Commit pushed via cmd -F flag
