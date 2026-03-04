Execute Sprint 11.0 + 11.1 for GregLite as defined in D:\Projects\GregLite\SPRINT_11_0_11_1_BRIEF.md

Read that file FIRST before doing anything. It contains the full task breakdown, file paths, implementation specs, and non-negotiable rules.

Summary: This is a combined cleanup + Agent SDK stub completion sprint.

Wave 1 (Route Consolidation): Remove /api/conversations routes (redirect consumers to /api/threads), audit /api/jobs vs /api/agent-sdk/jobs and consolidate, remove ConversationRepository if unused. DO NOT touch lib/kernl/database.ts — only the separate lib/database/connection.ts layer.

Wave 2 (Dead Code): Remove 3 dead stub functions from trigger-detector.ts (replaced by Haiku inference), update stale "Sprint 7G" comments across agent-sdk files, delete MORNING_BRIEFING.md.

Wave 3 (Agent SDK Stubs): Implement 4 real tools replacing NOT_IMPLEMENTED stubs: test_runner (runs vitest, parses results), shim_readonly_audit (EoS read-only scan), markdown_linter (rule-based, no deps), kernl_search_readonly (KERNL FTS5 query). Also implement detectShimLoop() in failure-modes.ts (3 consecutive SHIM calls with no improvement = BLOCKED).

Wave 4: tsc clean, all tests pass, single git commit.

SKIP Task 1 (Phase 8 file audit) — that's a manual David task documented at the bottom of the brief.

Project: D:\Projects\GregLite\app
Shell: Use cmd (not PowerShell — GREGORE profile interferes)
Commit message: "feat: Sprint 11.0+11.1 — cleanup, route consolidation, Agent SDK stubs implemented"
