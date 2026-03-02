GREGLITE SPRINT 7C - Error Handling + Restart: Failure Detection, Handoff Reports, INTERRUPTED State
Phase 7, Sprint 3 of 8 | Sequential after 7B | March 2026

YOUR ROLE: Build the error handling and restart layer. Sessions are non-resumable but restartable. Every failure mode has a detection path, a clean terminal state, and a handoff report that lets a new session pick up without duplicating work. David sees every failure clearly with actionable options. David is CEO. Zero debt, complete implementation.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Dev\CLAUDE_INSTRUCTIONS.md
2. D:\Dev\TECHNICAL_STANDARDS.md
3. D:\Dev\SUBAGENT_ROUTING_PROTOCOL.md
4. D:\Projects\GregLite\DEV_PROTOCOLS.md
5. D:\Projects\GregLite\STATUS.md
6. D:\Projects\GregLite\BLUEPRINT_FINAL.md - §4.3.4 (error handling) fully
7. D:\Projects\GregLite\BLUEPRINT_S7_AgentSDK_SelfEvolution.md - §7.8 (failure modes)
8. D:\Projects\GregLite\SPRINT_7B_COMPLETE.md
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL - STOP WHEN:
- Exponential backoff on tool call errors interacts badly with the kill switch from 7A - verify the two paths are mutually exclusive before implementing backoff
- Handoff report format needs to survive being injected into a new System Contract Header - test the combined prompt length before finalizing the format
- INTERRUPTED state detection on restart conflicts with legitimate long-running sessions - define the timeout threshold before implementing
- Sonnet has failed on the same problem twice → spawn Opus subagent
- Same fix 3+ times

SUBAGENT ROUTING:
[HAIKU] Write handoff-report.ts (buildHandoffReport) → template fully specified below, string interpolation, mechanical
[HAIKU] Write failure-modes.ts (FailureMode enum + detection predicates) → all modes specified, mechanical
[HAIKU] KERNL migration: CREATE session_restarts table → DDL specified, mechanical
[HAIKU] Run npx tsc --noEmit + capture errors → mechanical
[HAIKU] SESSION END: Update STATUS.md sprint 7C complete, write SPRINT_7C_COMPLETE.md, git commit message, git add/commit -F/push
[SONNET] error-handler.ts: per-failure-mode detection and routing, exponential backoff for tool errors (3x), network retry (1x)
[SONNET] Modify query.ts (7A) to wire error-handler into the event loop
[SONNET] restart.ts: spawnRestart(manifestId) - loads original manifest, appends handoff report, spawns new session
[SONNET] Test each failure mode: simulate context limit, tool error 3x, network timeout, impossible task, app restart
[OPUS] Escalation only if Sonnet fails twice on same problem

QUALITY GATES:
1. Each failure mode produces correct terminal state (FAILED, INTERRUPTED, BLOCKED)
2. Tool call errors: auto-retry 3x with exponential backoff (1s, 2s, 4s), then FAILED
3. Network interruption: 1 auto-retry after 2s, then FAILED
4. Context limit (max_tokens stop_reason): FAILED with message "Context limit reached. Split the manifest into smaller tasks."
5. Impossible task (Claude returns explicit impossibility): FAILED with no retry
6. Handoff report injected correctly when spawnRestart() is called
7. session_restarts table populated on every restart
8. pnpm test:run zero failures

FILE LOCATIONS:
  app/lib/agent-sdk/
    error-handler.ts      - detect failure mode, route to correct terminal state, backoff logic
    handoff-report.ts     - buildHandoffReport(manifestId) → string appended to new session prompt
    restart.ts            - spawnRestart(manifestId) → new session with original manifest + handoff

FAILURE MODES (from §4.3.4):
  CONTEXT_LIMIT:    stop_reason === 'max_tokens'
                    → status: FAILED, no retry
                    → message: "Context limit reached. Consider splitting into smaller tasks."

  TOOL_ERROR:       SDK error event with tool context, recoverable
                    → auto-retry 3x exponential backoff (1s, 2s, 4s delays)
                    → after 3 failures: status FAILED

  NETWORK_ERROR:    SDK timeout or connection reset
                    → 1 auto-retry after 2s
                    → after 1 failure: status FAILED

  IMPOSSIBLE_TASK:  Claude response contains explicit statement of impossibility
                    Detection: final message contains "cannot", "impossible", "not possible" + no files written
                    → status: FAILED, no retry
                    → message: "Task marked impossible by agent. Revise the manifest."

  APP_CRASH:        job_state row in running/working/validating on app restart
                    → status: INTERRUPTED (set during bootstrap, per 7A)
                    → David shown: [Restart with Handoff] [Cancel]

  SHIM_LOOP:        3 SHIM calls on same file with no score improvement
                    → status: BLOCKED (not FAILED - session is still running but stalled)
                    → escalation banner emitted to strategic thread
                    → implemented fully in 7G, stub the detection here

HANDOFF REPORT TEMPLATE (appended to system prompt on restart):
  "PRIOR EXECUTION CONTEXT:
  - This task was previously attempted. It did not complete.
  - The following files were written and exist on disk: {files_written}
  - The session was stopped because: {failure_reason}
  - Steps completed before failure: {steps_completed}
  - Last successful tool call: {last_tool_call}
  - Please inspect existing files before proceeding. Do not duplicate work already done."

buildHandoffReport(manifestId) reads job_state and produces this string. Files written comes from job_state.files_modified (JSON array). Failure reason comes from job_state.last_event. Steps from job_state.steps_completed.

SESSION RESTARTS TABLE:
  CREATE TABLE IF NOT EXISTS session_restarts (
    id TEXT PRIMARY KEY,
    original_manifest_id TEXT NOT NULL,
    new_manifest_id TEXT NOT NULL,
    restart_reason TEXT,        -- failure mode that caused the restart
    restarted_at INTEGER NOT NULL,
    restarted_by TEXT DEFAULT 'user'  -- 'user' or 'auto' (for future auto-restart)
  );

spawnRestart() creates a new manifest row (clone of original with new ID), appends handoff report to the system prompt, records the restart in session_restarts, and calls spawnSession() from 7A.

BACKOFF IMPLEMENTATION:
  async function withBackoff(fn: () => Promise<void>, maxRetries: number, baseDelayMs: number): Promise<void>

  Delays: baseDelayMs * 2^attempt (1s base → 1s, 2s, 4s for 3 retries).
  On final failure: throw the last error for error-handler to catch and set FAILED.

SESSION END:
1. npx tsc --noEmit - zero errors
2. pnpm test:run - zero failures
3. Update STATUS.md - Sprint 7C complete
4. git commit -F .git\COMMIT_MSG_TEMP (message: sprint-7c: error handling, failure modes, handoff reports, restart)
5. git push
6. Write SPRINT_7C_COMPLETE.md: each failure mode tested with simulated trigger, handoff report format validated against prompt length limits, restart round-trip tested

GATES CHECKLIST:
- CONTEXT_LIMIT: FAILED state, correct message, no retry
- TOOL_ERROR: 3 retries with 1s/2s/4s backoff, then FAILED
- NETWORK_ERROR: 1 retry after 2s, then FAILED
- IMPOSSIBLE_TASK: FAILED state, no retry, impossibility message preserved
- APP_CRASH simulation: running rows → INTERRUPTED on next bootstrap
- SHIM_LOOP stub: detection defined, BLOCKED state emitted, full implementation deferred to 7G
- buildHandoffReport() produces correct string from job_state data
- spawnRestart() creates new manifest, records session_restarts row, spawns new session
- Handoff report fits within prompt length constraints (test with longest realistic job_state)
- pnpm test:run clean
- Commit pushed via cmd -F flag
