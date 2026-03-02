GREGLITE SPRINT 7G - SHIM Hybrid Integration: In-Session Tool, Post-Processing Gate, Retry Ceiling
Phase 7, Sprint 7 of 8 | Sequential after 7F | March 2026

YOUR ROLE: Wire SHIM into Agent SDK sessions two ways. In-session: Claude calls SHIM as a tool while writing and self-corrects before finalizing. Post-processing: after session completes, SHIM runs on all modified files - if any fail with shim_required: true, no PR is created. Retry ceiling: 3 SHIM calls on the same file with no improvement → halt and escalate to the strategic thread. Also implement the SHIM_LOOP failure mode stubbed in 7C. David is CEO. Zero debt, complete implementation.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Dev\CLAUDE_INSTRUCTIONS.md
2. D:\Dev\TECHNICAL_STANDARDS.md
3. D:\Dev\SUBAGENT_ROUTING_PROTOCOL.md
4. D:\Projects\GregLite\DEV_PROTOCOLS.md
5. D:\Projects\GregLite\STATUS.md
6. D:\Projects\GregLite\BLUEPRINT_FINAL.md - §4.3.3 (shim_check tool), §4.3.4 (SHIM_LOOP failure)
7. D:\Projects\GregLite\BLUEPRINT_S7_AgentSDK_SelfEvolution.md - §7.6 (SHIM in self-evolution)
8. D:\Projects\GregLite\SPRINT_7F_COMPLETE.md
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL - STOP WHEN:
- SHIM's MCP interface differs from what the tool wrapper assumes - read SHIM's actual MCP tool definitions before building the wrapper
- Post-processing SHIM gate blocks a PR that should not be blocked (SHIM false positive on valid code) - verify the shim_required threshold against real GregLite files before hardening the gate
- The SHIM_LOOP detection from 7C needs to be replaced, not just wired - read the 7C implementation before modifying
- Sonnet has failed on the same problem twice → spawn Opus subagent
- Same fix 3+ times

SUBAGENT ROUTING:
[HAIKU] KERNL migration: CREATE shim_session_log table → DDL specified, mechanical
[HAIKU] Write shim-tool-definition.ts (Tool definition object for Agent SDK injection) → shape specified, mechanical
[HAIKU] Run npx tsc --noEmit + capture errors → mechanical
[HAIKU] SESSION END: Update STATUS.md sprint 7G complete, write SPRINT_7G_COMPLETE.md, git commit message, git add/commit -F/push
[SONNET] shim-tool.ts: in-session SHIM MCP tool wrapper - calls SHIM via MCP, returns score + issues to agent
[SONNET] retry-tracker.ts: per-file retry counter, detects 3x no-improvement ceiling, emits SHIM_LOOP event
[SONNET] post-processor.ts: runPostProcessingShim(manifestId) - scan all modified files, gate on shim_required
[SONNET] Replace SHIM_LOOP stub in error-handler.ts (7C) with full implementation using retry-tracker
[SONNET] Modify tool-injector.ts (7B) to replace shim_check stub with real shim-tool implementation
[SONNET] Modify query.ts (7A) to call runPostProcessingShim() after session COMPLETED before writing final state
[OPUS] Escalation only if Sonnet fails twice on same problem - particularly if SHIM MCP interface requires architectural changes

QUALITY GATES:
1. In-session shim_check tool available to code and self_evolution session types
2. Claude can call shim_check(filePath) during a session and receive score + issues in response
3. Retry tracker: 3 calls on same file with no score improvement → SHIM_LOOP event emitted
4. SHIM_LOOP: session moves to BLOCKED, escalation banner appears in strategic thread
5. Post-processing: runs on all files in job_state.files_modified after COMPLETED
6. Post-processing gate: any file with shim_required: true AND score < 70 → session downgraded to FAILED, no PR
7. shim_score_after written to manifests table after post-processing completes
8. pnpm test:run zero failures

FILE LOCATIONS:
  app/lib/agent-sdk/
    shim-tool.ts            - in-session SHIM tool: calls SHIM MCP, returns structured result
    shim-tool-definition.ts - Tool definition object for SDK injection
    retry-tracker.ts        - per-file SHIM call counter + improvement detector
    post-processor.ts       - post-processing SHIM gate after session completion

SHIM TOOL DEFINITION:
  {
    name: 'shim_check',
    description: 'Run SHIM quality analysis on a file you have written or modified. Returns a health score (0-100) and any critical issues. Use this after writing a file to self-correct before finishing.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Absolute path to the file to analyze' }
      },
      required: ['file_path']
    }
  }

SHIM TOOL RESPONSE (returned to agent):
  {
    file_path: string,
    health_score: number,         // 0-100
    shim_required: boolean,       // true if score < 70
    critical_issues: string[],    // list of critical issue descriptions
    warning_issues: string[],     // list of warning issue descriptions
    suggestion: string            // "Fix these critical issues before proceeding: ..."
  }

RETRY TRACKER:
Track SHIM calls per file per session. Key: {manifestId}:{filePath}.

  export function recordShimCall(manifestId: string, filePath: string, scoreBefore: number, scoreAfter: number): ShimRetryStatus

  ShimRetryStatus: { callCount: number, improved: boolean, triggerLoop: boolean }
  triggerLoop: true when callCount >= 3 AND (scoreAfter - scoreBefore) <= 0 on latest call

When triggerLoop is true:
  1. Set job_state status to BLOCKED
  2. Emit an escalation event to the strategic thread: "SHIM loop detected on {filePath}. Agent called SHIM 3 times with no improvement. Manual review required."
  3. The session does not auto-terminate - David decides: [Continue Anyway] [Kill Session]

SHIM_LOOP ESCALATION TO STRATEGIC THREAD:
Write a message to the active strategic thread (threads table) as a system message:
  role: 'system'
  content: "⚠️ SHIM Loop Detected — Agent SDK session '{manifest.title}' has called SHIM on {filePath} 3 times with no quality improvement (score: {score}). Session is blocked. [Continue Anyway] [Kill Session]"

The [Continue Anyway] and [Kill Session] are action buttons in the strategic thread UI that call the appropriate job API endpoints. Wire these up as inline action buttons in the message renderer.

POST-PROCESSING GATE:
After a session reaches COMPLETED state (before final job_state write):
  1. Read job_state.files_modified (JSON array)
  2. For each file: call SHIM, collect results
  3. Capture average score as shim_score_after, write to manifests table
  4. If ANY file has shim_required: true (score < 70): downgrade session to FAILED
  5. Write failure reason: "Post-processing SHIM gate failed. Files with critical issues: [list]"
  6. If all files pass: proceed to COMPLETED, shim_score_after recorded

SHIM_SESSION_LOG TABLE:
  CREATE TABLE IF NOT EXISTS shim_session_log (
    id TEXT PRIMARY KEY,
    manifest_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    call_number INTEGER NOT NULL,   -- 1, 2, 3...
    score_before REAL,
    score_after REAL NOT NULL,
    shim_required INTEGER NOT NULL,
    logged_at INTEGER NOT NULL
  );

This feeds the SPRINT_7G_COMPLETE.md report and eventual analytics on which file types trigger SHIM loops most often.

CONFIGURABLE CEILING:
The 3-attempt ceiling must be configurable in KERNL budget_config table:
  key: 'shim_retry_ceiling', value: '3'  (default)

Read this at module init. Do not hardcode 3 in the retry-tracker.

SESSION END:
1. npx tsc --noEmit - zero errors
2. pnpm test:run - zero failures
3. Update STATUS.md - Sprint 7G complete
4. git commit -F .git\COMMIT_MSG_TEMP (message: sprint-7g: SHIM hybrid integration, in-session tool, post-processing gate, retry ceiling)
5. git push
6. Write SPRINT_7G_COMPLETE.md: in-session SHIM tool tested with real Agent SDK session, SHIM_LOOP trigger tested with simulated no-improvement scenario, post-processing gate tested against a file with known low SHIM score, ceiling configurability verified, any SHIM MCP interface discoveries documented

GATES CHECKLIST:
- shim_check tool injected for code and self_evolution session types only
- Agent can call shim_check(filePath) and receive score + issues
- retry-tracker increments correctly across multiple SHIM calls on same file
- SHIM_LOOP triggers at 3 calls with no improvement (configurable ceiling respected)
- SHIM_LOOP: job_state → BLOCKED, strategic thread receives escalation message
- [Continue Anyway] and [Kill Session] action buttons work from strategic thread message
- Post-processing runs on all files_modified after COMPLETED
- Post-processing: score < 70 file → session FAILED, no PR
- shim_score_after written to manifests table
- shim_session_log populated for every SHIM call
- shim_retry_ceiling configurable via budget_config
- pnpm test:run clean
- Commit pushed via cmd -F flag
