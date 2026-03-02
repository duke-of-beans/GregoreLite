GREGLITE SPRINT 7B - Permission Matrix: Tool Injection + Write Scope Enforcement
Phase 7, Sprint 2 of 8 | Sequential after 7A | March 2026

YOUR ROLE: Build the permission matrix. Every session type gets a declarative tool set injected at spawn time. A filesystem intercept enforces write scope against the manifest files[] list as a second layer of enforcement. No session type can escape its envelope because the tools to escape simply are not injected. David is CEO. Zero debt, complete implementation.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Dev\CLAUDE_INSTRUCTIONS.md
2. D:\Dev\TECHNICAL_STANDARDS.md
3. D:\Dev\SUBAGENT_ROUTING_PROTOCOL.md
4. D:\Projects\GregLite\DEV_PROTOCOLS.md
5. D:\Projects\GregLite\STATUS.md
6. D:\Projects\GregLite\BLUEPRINT_FINAL.md - §4.3.3 (permission matrix) fully
7. D:\Projects\GregLite\BLUEPRINT_S7_AgentSDK_SelfEvolution.md - §7.5 (scope guardrails)
8. D:\Projects\GregLite\SPRINT_7A_COMPLETE.md
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL - STOP WHEN:
- The Agent SDK tool injection API differs from what the blueprint assumes - read actual SDK docs before building the tool injector
- Write scope enforcement requires intercepting at a layer that does not exist yet in query.ts - coordinate with 7A implementation before proceeding
- A session type in the matrix needs a tool not yet implemented in the codebase - build a stub with clear TODO, do not silently skip
- Sonnet has failed on the same problem twice → spawn Opus subagent
- Same fix 3+ times

SUBAGENT ROUTING:
[HAIKU] Write permission-config.ts (static config table: session type → permissionMode + tool list) → table fully specified below, mechanical
[HAIKU] Write scope-violations table KERNL migration → DDL specified, mechanical
[HAIKU] Run npx tsc --noEmit + capture errors → mechanical
[HAIKU] SESSION END: Update STATUS.md sprint 7B complete, write SPRINT_7B_COMPLETE.md, git commit message, git add/commit -F/push
[SONNET] tool-injector.ts: selectTools(sessionType) switch statement, builds tool array for SDK spawn
[SONNET] scope-enforcer.ts: filesystem intercept wrapper, validates every proposed write against manifest files[], logs violations
[SONNET] Modify query.ts (from 7A) to call tool-injector at spawn time and wrap fs tools with scope-enforcer
[SONNET] Test: spawn one session of each type, verify tool set matches matrix, verify out-of-scope write is rejected
[OPUS] Escalation only if Sonnet fails twice on same problem

QUALITY GATES:
1. spawnSession() injects correct tool set for each of the 6 session types
2. scope-enforcer rejects writes to paths not in manifest files[]
3. Rejected writes logged to scope_violations table with manifest_id, attempted_path, timestamp
4. No session type can write outside its CWD scope (enforced at tool layer, not prompt)
5. self_evolution type correctly gets git branch tools in its tool set
6. readOnly types (research, analysis) receive no write tools
7. pnpm test:run zero failures

FILE LOCATIONS:
  app/lib/agent-sdk/
    permission-config.ts   - static config table: session type → { permissionMode, tools[] }
    tool-injector.ts       - selectTools(sessionType, manifest) → ToolDefinition[]
    scope-enforcer.ts      - wrapFsTool(tool, manifest) → intercept + validate write paths

PERMISSION MATRIX (from §4.3.3):
  code:
    permissionMode: 'acceptEdits'
    tools: [fs_read, fs_write, test_runner, shim_check]
    cwd: project root (from manifest.project_path)

  test:
    permissionMode: 'acceptEdits'
    tools: [fs_read, fs_write, test_runner]
    cwd: project root

  documentation:
    permissionMode: 'acceptEdits'
    tools: [fs_read, fs_write_docs_only, markdown_linter]
    cwd: /docs subdirectory only

  research:
    permissionMode: 'readOnly'
    tools: [fs_read, kernl_search_readonly]
    cwd: temp workspace (os.tmpdir())

  analysis:
    permissionMode: 'readOnly'
    tools: [fs_read, shim_readonly_audit]
    cwd: project root (read only)

  self_evolution:
    permissionMode: 'acceptEdits'
    tools: [fs_read, fs_write, git_branch_tools, shim_check, test_runner]
    cwd: D:\Projects\GregLite\ (branch-locked, enforced separately in 7H)

Tool implementations for this sprint: fs_read and fs_write are the core Node.js filesystem tools wrapped by scope-enforcer. test_runner, shim_check, markdown_linter, shim_readonly_audit, kernl_search_readonly, and git_branch_tools are STUBS in this sprint — implement the interfaces, return NotImplemented errors with clear messages. They will be implemented in 7G (SHIM tools) and 7H (git tools).

SCOPE ENFORCER:
The scope enforcer wraps every fs_write tool call. Before executing the write:
  1. Resolve the absolute path of the proposed write
  2. Check it against manifest.files[] (also resolved to absolute paths)
  3. If not in the list: reject the write, log to scope_violations, return an error to the agent
  4. If in the list: allow the write to proceed

The agent receives a clear error message: "Write to [path] rejected. This path is not in the manifest files list. Modify only the files specified in the manifest."

SCOPE VIOLATIONS TABLE:
  CREATE TABLE IF NOT EXISTS scope_violations (
    id TEXT PRIMARY KEY,
    manifest_id TEXT NOT NULL,
    attempted_path TEXT NOT NULL,
    resolved_path TEXT,
    session_type TEXT,
    logged_at INTEGER NOT NULL
  );

DOCUMENTATION TOOL RESTRICTION:
For documentation sessions, fs_write_docs_only is a scope-enforcer variant that additionally checks the path starts with the /docs subdirectory of the project. Any write outside /docs is rejected regardless of what the manifest says.

SESSION END:
1. npx tsc --noEmit - zero errors
2. pnpm test:run - zero failures
3. Update STATUS.md - Sprint 7B complete
4. git commit -F .git\COMMIT_MSG_TEMP (message: sprint-7b: permission matrix, tool injection, write scope enforcement)
5. git push
6. Write SPRINT_7B_COMPLETE.md: each session type tested with correct tool set, out-of-scope write rejection verified, stub tool list documented for 7G/7H

GATES CHECKLIST:
- code session: gets fs_read, fs_write, test_runner, shim_check
- test session: gets fs_read, fs_write, test_runner
- documentation session: gets fs_read, fs_write_docs_only, markdown_linter; /docs restriction enforced
- research session: gets fs_read, kernl_search_readonly; no write tools
- analysis session: gets fs_read, shim_readonly_audit; no write tools
- self_evolution session: gets full tool set including git_branch_tools stubs
- Out-of-scope write → rejected + logged to scope_violations + agent receives clear error
- scope_violations table populated after rejection test
- All stub tools return NotImplemented error with descriptive message
- pnpm test:run clean
- Commit pushed via cmd -F flag
