GREGLITE SPRINT 7F - Job Queue UI: Status Display, Live Output, Cost Ticker, Action Buttons
Phase 7, Sprint 6 of 8 | Sequential after 7E | March 2026

YOUR ROLE: Build the job queue UI. This is the control surface for everything 7A through 7E built. David sees every session's state, cost, and progress in real time. Live output is opt-in. INTERRUPTED sessions show actionable restart options. PENDING sessions show queue position. Cost ticker updates live. Action buttons: Kill, Restart, View Output, [Merge PR] placeholder. David is CEO. Zero debt, complete implementation.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Dev\CLAUDE_INSTRUCTIONS.md
2. D:\Dev\TECHNICAL_STANDARDS.md
3. D:\Dev\SUBAGENT_ROUTING_PROTOCOL.md
4. D:\Projects\GregLite\DEV_PROTOCOLS.md
5. D:\Projects\GregLite\STATUS.md
6. D:\Projects\GregLite\BLUEPRINT_FINAL.md - §4.3.2 (UI surface), §4.3.5 (cost UI), §4.3.6 (queue UI)
7. D:\Projects\GregLite\BLUEPRINT_S7_AgentSDK_SelfEvolution.md - §7.7 ([Merge PR] button)
8. D:\Projects\GregLite\SPRINT_7E_COMPLETE.md
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL - STOP WHEN:
- Live output streaming from the ring buffer (7A session-logger) to the UI requires a polling or push mechanism not yet established - design the data flow before building the component
- The War Room dependency graph (Phase 2) already has a JobNode component - read it before building JobCard to avoid duplication or conflicts
- [Merge PR] button must only appear for self_evolution sessions AND only after CI passes - do not simplify this to "always show for self_evolution"
- Sonnet has failed on the same problem twice → spawn Opus subagent
- Same fix 3+ times

SUBAGENT ROUTING:
[HAIKU] JobCard.tsx skeleton (layout, props interface, status color mapping) → layout specified, mechanical
[HAIKU] JobStatusBadge.tsx (status → color + label) → mapping fully specified, mechanical
[HAIKU] API routes: GET /api/agent-sdk/jobs, GET /api/agent-sdk/jobs/:id, GET /api/agent-sdk/jobs/:id/output → specs defined, mechanical scaffolding
[HAIKU] POST /api/agent-sdk/jobs/:id/kill route → calls killSession() from 7A, mechanical
[HAIKU] POST /api/agent-sdk/jobs/:id/restart route → calls spawnRestart() from 7C, mechanical
[HAIKU] Run npx tsc --noEmit + capture errors → mechanical
[HAIKU] SESSION END: Update STATUS.md sprint 7F complete, write SPRINT_7F_COMPLETE.md, git commit message, git add/commit -F/push
[SONNET] JobQueue.tsx: container, polling (2s interval), session list sorted by priority + recency
[SONNET] LiveOutputPanel.tsx: opt-in toggle, streams from ring buffer via /jobs/:id/output endpoint, auto-scroll
[SONNET] InterruptedSessionCard.tsx: INTERRUPTED state with [Restart with Handoff] [Cancel] buttons
[SONNET] PendingSessionCard.tsx: PENDING state with queue position, estimated wait
[SONNET] BudgetSettingsPanel.tsx: soft cap, daily cap, rate limit fields with save
[SONNET] Wire Zustand store updates: job state changes → JobQueue re-renders without full page reload
[OPUS] Escalation only if Sonnet fails twice on same problem - particularly if real-time update architecture needs rethinking

QUALITY GATES:
1. JobQueue shows all active, pending, completed, and interrupted sessions
2. Status badge correct color for each state: spawning (grey), running (blue), working (blue pulse), validating (amber), completed (green), failed (red), blocked (amber), interrupted (orange), pending (grey with position)
3. CostTicker updates every 2 seconds during active session
4. Live output panel: opt-in toggle, scrolls to bottom on new content, shows last 500 lines (not full buffer)
5. INTERRUPTED sessions show [Restart with Handoff] and [Cancel] buttons
6. Kill button: confirmation dialog ("Kill this session? Files written will be preserved."), then calls kill API
7. [Merge PR] button: placeholder only in this sprint (no GitHub API yet - that is 7H). Visible only for self_evolution sessions in COMPLETED state.
8. DailyBurnBadge in status bar showing today's total
9. pnpm test:run zero failures

FILE LOCATIONS:
  app/components/agent-sdk/
    JobQueue.tsx              - main container, polling loop, session list
    JobCard.tsx               - single session card (status, cost, steps, actions)
    JobStatusBadge.tsx        - status → color + label
    LiveOutputPanel.tsx       - opt-in raw output viewer
    InterruptedSessionCard.tsx - INTERRUPTED state with restart/cancel actions
    PendingSessionCard.tsx    - PENDING state with queue position
    BudgetSettingsPanel.tsx   - cap configuration UI

  app/app/api/agent-sdk/
    jobs/route.ts             - GET: list all jobs with current state
    jobs/[id]/route.ts        - GET: single job detail
    jobs/[id]/output/route.ts - GET: last 500 lines from ring buffer
    jobs/[id]/kill/route.ts   - POST: kill session
    jobs/[id]/restart/route.ts - POST: restart with handoff

JOB CARD LAYOUT:
  [StatusBadge] [Title (manifest.title, truncated 60 chars)]           [Kill]
  Type: code | Steps: 12 | Files: 3 modified
  Cost: $0.43  [████████░░] 86% of $0.50 cap       Elapsed: 2m 14s
  [View Live Output ▼]

  For INTERRUPTED:
  [⚠ INTERRUPTED] [Title]
  Stopped because: Tool call failed after 3 retries
  Files written: src/lib/foo.ts, src/lib/bar.ts
  [Restart with Handoff]  [Cancel]

  For PENDING:
  [PENDING #3] [Title]
  Waiting for slot. Priority: code. Estimated wait: ~2 sessions ahead.
  [Cancel]

  For COMPLETED self_evolution:
  [✅ COMPLETED] [Title]
  Cost: $1.24  |  Steps: 47  |  Files: 8 modified  |  SHIM: 87→91
  [View Output]  [Merge PR]   ← [Merge PR] is placeholder text only in 7F

STATUS COLORS:
  spawning:    grey (#94a3b8)
  running:     blue (#3b82f6)
  working:     blue pulse animation
  validating:  amber (#f59e0b)
  completed:   green (#22c55e)
  failed:      red (#ef4444)
  blocked:     amber (#f59e0b)
  interrupted: orange (#f97316)
  pending:     grey (#94a3b8) with queue position number

POLLING:
JobQueue polls /api/agent-sdk/jobs every 2 seconds. This is intentionally simple - no websockets in this sprint. If the polling approach causes performance issues, document in SPRINT_7F_COMPLETE.md and propose the upgrade path. Do not prematurely optimize.

LIVE OUTPUT:
/api/agent-sdk/jobs/:id/output returns last 500 lines from the session ring buffer (or from temp log file if session >5 min). LiveOutputPanel shows these lines in a monospace pre element. New lines append at bottom. Auto-scroll unless David has scrolled up (standard scroll-lock pattern).

BUDGET SETTINGS:
BudgetSettingsPanel allows David to update session_soft_cap_usd, daily_hard_cap_usd, and rate_limit_tokens_per_minute in the budget_config table. Simple form: three number inputs, Save button. Show current values. Place in Settings section of the app (or as a modal from the DailyBurnBadge click).

SESSION END:
1. npx tsc --noEmit - zero errors
2. pnpm test:run - zero failures
3. Update STATUS.md - Sprint 7F complete
4. git commit -F .git\COMMIT_MSG_TEMP (message: sprint-7f: job queue UI, live output, cost ticker, action buttons)
5. git push
6. Write SPRINT_7F_COMPLETE.md: UI walkthrough with each status state demonstrated, live output polling verified, INTERRUPTED restart flow tested end-to-end, [Merge PR] placeholder noted as stub for 7H, any polling performance observations

GATES CHECKLIST:
- JobQueue renders all session states correctly
- Status badge colors match spec
- CostTicker updates every 2s during active session
- Live output panel shows last 500 lines, auto-scrolls
- INTERRUPTED sessions show correct failure reason + file list
- [Restart with Handoff] calls spawnRestart(), new session visible in queue
- Kill button: shows confirmation, calls kill API, session moves to FAILED
- [Merge PR] button visible for completed self_evolution sessions (placeholder - no action yet)
- DailyBurnBadge in status bar showing correct daily total
- BudgetSettingsPanel saves to budget_config correctly
- Pending sessions show queue position
- pnpm test:run clean
- Commit pushed via cmd -F flag
