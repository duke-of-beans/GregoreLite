GREGLITE SPRINT 7H - Self-Evolution Mode: Branch Management, .gregignore, CI, GitHub PR, [Merge PR]
Phase 7, Sprint 8 of 8 | Sequential after 7G | March 2026

YOUR ROLE: Build Self-Evolution Mode and certify Phase 7 complete. GregLite opens an Agent SDK session against its own source code on a staging branch. Session passes SHIM + local CI. GitHub PR is created automatically. Gregore Lite polls CI. When CI passes, [Merge PR] becomes live. David clicks it. Squash merge happens via GitHub API. David is always the only merge gate. This is the final sprint of Phase 7 — also includes the integration test suite and Phase 7 certification. David is CEO. Zero debt, complete implementation.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Dev\CLAUDE_INSTRUCTIONS.md
2. D:\Dev\TECHNICAL_STANDARDS.md
3. D:\Dev\SUBAGENT_ROUTING_PROTOCOL.md
4. D:\Projects\GregLite\DEV_PROTOCOLS.md
5. D:\Projects\GregLite\STATUS.md
6. D:\Projects\GregLite\BLUEPRINT_FINAL.md - §4.3.3 (self_evolution session type), §4.3.5
7. D:\Projects\GregLite\BLUEPRINT_S7_AgentSDK_SelfEvolution.md - §7 fully (all sections)
8. D:\Projects\GregLite\SPRINT_7G_COMPLETE.md
9. All previous SPRINT_7[A-G]_COMPLETE.md files - scan for open issues flagged by prior sprints
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL - STOP WHEN:
- GitHub PAT is not in KERNL vault - do not proceed with PR creation until token is confirmed present and valid
- Local test suite run against a staging branch produces different results than master - investigate before treating as a CI gate pass
- .gregignore parsing produces false positives that block valid manifest targets - test against real GregLite files before hardening
- Protected path enforcement rejects a file it should allow - the protection list must be exact, not pattern-matched broadly
- Sonnet has failed on the same problem twice → spawn Opus subagent
- Same fix 3+ times

SUBAGENT ROUTING:
[HAIKU] Create .gregignore file at repo root with initial protected entries → content specified, mechanical file write
[HAIKU] KERNL migration: add self_evolution columns to manifests if missing → PRAGMA check first, DDL specified, mechanical
[HAIKU] Write branch-namer.ts (generateBranchName from slug) → format specified, string formatting, mechanical
[HAIKU] Write pr-description-builder.ts (buildPRDescription from manifest + SHIM scores) → template specified, mechanical
[HAIKU] GitHub polling: GET /repos/{owner}/{repo}/statuses/{sha} every 5 min → HTTP call, mechanical
[HAIKU] Run EoS self-scan on full codebase, capture output → mechanical execution
[HAIKU] Run pnpm test:run final pass, capture counts → mechanical
[HAIKU] UPDATE BLUEPRINT_FINAL.md §13 Phase 7 completion entry → content specified, mechanical doc write
[HAIKU] SESSION END: Update STATUS.md Phase 7 complete, write SPRINT_7H_COMPLETE.md, git commit message, git add/commit -F/push
[SONNET] branch-manager.ts: repo clean check, create branch, lock CWD, cleanup on abort
[SONNET] protected-paths.ts: load .gregignore + hard-coded protected paths, enforce at tool layer
[SONNET] git-tools.ts: git_commit tool implementation (local only, no push), git_status, git_diff
[SONNET] github-api.ts: createPR(), mergePR(), pollCIStatus(), storePAT(), getPAT()
[SONNET] self-evolution-orchestrator.ts: full flow - trigger → repo check → branch → manifest → spawn → SHIM gate → CI → PR → poll → [Merge PR] live
[SONNET] Wire [Merge PR] button in JobCard.tsx (7F) to call mergePR() after CI confirmation
[SONNET] Write phase7-integration.test.ts: 25+ tests covering full Agent SDK + self-evolution flow
[SONNET] Fix any failing integration tests or EoS critical issues
[OPUS] TASK: Security audit - verify protected paths enforcement is airtight. Trace every write path in a self_evolution session and confirm none can reach src/agent-sdk/, src/kernl/core/, src/self-evolution/, or @no-self-evolve files. This requires genuine synthesis across scope-enforcer (7B), protected-paths (7H), and .gregignore parsing - novel verification, not mechanical.

QUALITY GATES:
1. Self-evolution session cannot write to protected paths (hard enforcement, tested)
2. Branch created in correct format before any session work begins
3. Dirty repo → session aborted before branch creation
4. .gregignore read + enforced: manifest targeting .gregignore-listed file is rejected before spawn
5. git_commit tool: local commits only, no push authority
6. Post-processing SHIM gate (7G) must pass before PR creation
7. Local test suite must pass before PR creation
8. PR created with auto-generated description: goal, files changed, SHIM before/after, session log link
9. CI polling every 5 minutes until pass or 24-hour timeout
10. [Merge PR] button only live after CI passes - never before
11. Squash merge via GitHub API after David clicks [Merge PR]
12. Phase 7 integration test suite: 25+ tests, all passing
13. EoS self-scan: >= 75 (same threshold as Phase 6 gate)
14. pnpm test:run zero failures (full suite including new integration tests)

FILE LOCATIONS:
  app/lib/agent-sdk/self-evolution/
    self-evolution-orchestrator.ts  - full flow controller
    branch-manager.ts               - repo check, create/cleanup branch
    protected-paths.ts              - .gregignore + hard-coded list enforcement
    branch-namer.ts                 - generateBranchName(slug) → string
    git-tools.ts                    - git_commit, git_status, git_diff tool implementations
    github-api.ts                   - createPR, mergePR, pollCIStatus, PAT management
    pr-description-builder.ts       - buildPRDescription(manifest, shimScores) → markdown string

  app/lib/agent-sdk/__tests__/
    phase7-integration.test.ts      - 25+ integration tests

  .gregignore                       - repo root, user-editable additional exclusions

SELF-EVOLUTION TRIGGER FLOW:
  1. David types trigger in strategic thread (or accepts Cross-Context/Ghost suggestion)
  2. System generates manifest: task type = self_evolution, target_component, goal_summary, files[]
  3. Manifest generator reads .gregignore + protected-paths list - rejects if any files[] target is protected
  4. David sees manifest preview + [Confirm] [Cancel]
  5. On Confirm: self-evolution-orchestrator.ts takes over
  6. orchestrator: verify clean repo → create branch → capture shim_score_before → spawn session
  7. Session runs with self_evolution tool set (7B) and scope enforcement (7B)
  8. Session completes → post-processing SHIM (7G) → local test run
  9. All gates pass → createPR() → start CI polling
  10. CI passes → job_state updated → [Merge PR] button goes live in JobCard
  11. David clicks [Merge PR] → mergePR() squash merge → local pull → final SHIM + test confirmation

BRANCH NAMING:
  Format: self-evolve/{YYYYMMDD-HHMM}-{slug}
  Slug: first 4 words of goal_summary, lowercased, hyphenated, alphanumeric only
  Example: self-evolve/20260302-0930-improve-shim-retry-logic

PROTECTED PATHS (hard-coded, non-negotiable):
  app/lib/agent-sdk/          - the modification engine itself
  app/lib/kernl/core/         - KERNL core persistence
  app/lib/agent-sdk/self-evolution/  - self-evolution orchestrator
  Any file containing // @no-self-evolve on any line (check file content before including in manifest)

.GREGIGNORE FORMAT (repo root):
  # Lines starting with # are comments
  # One path pattern per line (relative to repo root)
  # Supports glob patterns via micromatch
  app/lib/kernl/migrations/    # don't auto-modify migration history
  .env*                        # never touch env files

Initial .gregignore content:
  # GregLite self-evolution exclusions
  # Add paths here to prevent self-evolution sessions from targeting them
  # Supports glob patterns (micromatch)
  app/lib/kernl/migrations/
  .env*
  *.secret
  pricing.yaml

GIT TOOLS (local only):
  git_commit: stages all modified files from manifest.files[], writes commit message, commits locally. NO push.
  git_status: returns list of modified/untracked files in working tree.
  git_diff: returns diff for a specific file (for agent self-review before committing).

These tools are ONLY injected for self_evolution session type. No other session type gets git tools.

GITHUB PR API:
  createPR(branch, title, body, baseBranch='master'):
    POST /repos/{owner}/{repo}/pulls
    title: manifest.title
    body: buildPRDescription(manifest, shimScores)
    PAT from KERNL vault (key: 'github_pat')

  pollCIStatus(sha):
    GET /repos/{owner}/{repo}/statuses/{sha}
    Returns: 'success' | 'failure' | 'pending'
    Poll every 5 minutes, timeout after 24 hours

  mergePR(prNumber):
    PUT /repos/{owner}/{repo}/pulls/{prNumber}/merge
    merge_method: 'squash'
    commit_title: manifest.title + ' (#' + prNumber + ')'

PAT STORAGE: Store GitHub PAT in KERNL vault (same vault used by Ghost email connectors in Phase 6). Key: 'github_pat'. If not present when PR creation is attempted, show a settings prompt: "GitHub PAT required. Enter your Personal Access Token with repo scope." Store on entry.

PR DESCRIPTION TEMPLATE:
  ## {manifest.goal_summary}

  **Session:** {manifest.id}
  **Type:** Self-Evolution
  **Target:** {manifest.target_component}

  ### Changes
  {files_changed_list}

  ### SHIM Quality
  | | Score |
  |---|---|
  | Before | {shim_score_before} |
  | After | {shim_score_after} |

  ### Session Log
  View full session log: [Session {manifest.id}]({kernl_session_link})

  ---
  *Generated by GregLite Self-Evolution Mode*

PHASE 7 INTEGRATION TESTS (phase7-integration.test.ts - 25+ tests):

  Agent SDK Core (7A):
  - buildSystemPrompt() produces correct section order
  - Manifest JSON is whitespace-stripped in prompt
  - job_state created on session spawn
  - Checkpoint writes every 5 tool calls
  - Running sessions → INTERRUPTED on restart simulation

  Permission Matrix (7B):
  - code session gets correct tool set
  - research session gets no write tools
  - Out-of-scope write rejected and logged to scope_violations
  - documentation session write to non-/docs path rejected

  Error Handling (7C):
  - TOOL_ERROR: 3 retries then FAILED
  - CONTEXT_LIMIT: FAILED immediately, correct message
  - INTERRUPTED: handoff report contains files_modified and failure_reason
  - spawnRestart() creates session_restarts record

  Cost Accounting (7D):
  - session_costs row updated on checkpoint
  - calculateCost() matches expected USD for known token counts
  - Daily cap blocks new spawns when exceeded
  - Override for Today sets flag correctly

  Concurrency (7E):
  - Sessions 1-8 start immediately
  - Session 9 enters PENDING with queue position 1
  - Priority: self_evolution ahead of code
  - Completed session promotes next PENDING

  SHIM Integration (7G):
  - shim_check tool injected for code sessions
  - SHIM_LOOP triggers at ceiling (3 calls, no improvement)
  - Post-processing gate: score < 70 → session FAILED
  - shim_score_after written to manifests

  Self-Evolution (7H):
  - Dirty repo → session aborted before branch creation
  - Protected path in manifest.files[] → manifest rejected before spawn
  - .gregignore pattern match → manifest rejected
  - Branch created in correct format
  - git_commit tool produces local commit (no remote push)
  - [Merge PR] button not active until CI passes (mock CI response)
  - squash merge called with correct parameters

PHASE 7 CERTIFICATION TASKS:

TASK 1 - Full integration test suite (above)

TASK 2 - Security audit (OPUS task):
Trace every write path in a self_evolution session. Confirm none can reach:
  - src/agent-sdk/ (or app/lib/agent-sdk/)
  - src/kernl/core/ (or app/lib/kernl/core/)
  - src/self-evolution/ (or app/lib/agent-sdk/self-evolution/)
  - Files with // @no-self-evolve
Verify the three enforcement layers work together: scope-enforcer (7B) + protected-paths (7H) + .gregignore (7H).
Document findings in SPRINT_7H_COMPLETE.md security section.

TASK 3 - EoS self-scan:
Run EoS on the Phase 7 codebase. Target: >= 75 (same as Phase 6 gate).
Record full output in SPRINT_7H_COMPLETE.md.

TASK 4 - Performance measurement:
  Session spawn to first tool call: target < 5s
  Post-processing SHIM on 10 files: target < 30s
  PR creation: target < 10s (network dependent)
Record in SPRINT_7H_COMPLETE.md.

TASK 5 - Update BLUEPRINT_FINAL.md §13:
Mark Phase 7 complete with: date, test count, EoS score, performance measurements, first successful self-evolution session (if run during testing).

SESSION END:
1. npx tsc --noEmit - zero errors
2. pnpm test:run - all tests passing including phase7-integration.test.ts
3. Update STATUS.md - Phase 7 complete
4. Update BLUEPRINT_FINAL.md §13 - Phase 7 completion logged
5. git commit -F .git\COMMIT_MSG_TEMP (message: phase-7: complete - Agent SDK, self-evolution mode, SHIM hybrid, CI gate, GitHub PR)
6. git push
7. Write SPRINT_7H_COMPLETE.md: integration test results, security audit findings, EoS score, performance measurements, Phase 8 readiness notes

GATES CHECKLIST - PHASE 7 CERTIFICATION:
- All 25+ integration tests passing
- Protected paths: scope-enforcer + protected-paths + .gregignore all enforced and tested
- Security audit: no write path to protected directories (OPUS verified)
- Dirty repo → abort before branch creation
- Branch format correct
- git_commit tool: local only, no push
- PR created with correct auto-generated description
- CI polling every 5 minutes
- [Merge PR] only active after CI passes
- Squash merge executes correctly
- shim_score_before and shim_score_after in manifests table
- EoS >= 75 on Phase 7 codebase
- BLUEPRINT_FINAL.md Phase 7 marked complete
- STATUS.md Phase 7 complete
- pnpm test:run zero failures (full suite)
- Phase 7 completion commit pushed via cmd -F flag
