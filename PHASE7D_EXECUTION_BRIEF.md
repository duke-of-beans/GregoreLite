GREGLITE SPRINT 7D - Cost Accounting: Token Capture, session_costs Table, UI Surface
Phase 7, Sprint 4 of 8 | Sequential after 7C | March 2026

YOUR ROLE: Build cost accounting. Every session's spend is visible while it runs - live cost ticker, session total on completion, project rollups, daily burn in the status bar. Budget caps enforce spend limits. Pricing lives in pricing.yaml so Anthropic price changes never require a code change. David is CEO. Zero debt, complete implementation.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Dev\CLAUDE_INSTRUCTIONS.md
2. D:\Dev\TECHNICAL_STANDARDS.md
3. D:\Dev\SUBAGENT_ROUTING_PROTOCOL.md
4. D:\Projects\GregLite\DEV_PROTOCOLS.md
5. D:\Projects\GregLite\STATUS.md
6. D:\Projects\GregLite\BLUEPRINT_FINAL.md - §4.3.5 (cost accounting) fully
7. D:\Projects\GregLite\SPRINT_7C_COMPLETE.md
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL - STOP WHEN:
- The existing pricing.ts from the Phase 0 scaffold uses a different model key format than what the Agent SDK returns in usage events - reconcile before building the cost calculator
- Daily hard cap enforcement requires a persistent daily total that survives app restarts - design the storage before implementing
- Budget cap override UI requires the strategic thread to be unblocked by David - do not auto-unblock after a timeout
- Sonnet has failed on the same problem twice → spawn Opus subagent
- Same fix 3+ times

SUBAGENT ROUTING:
[HAIKU] KERNL migration: CREATE session_costs table → DDL fully specified below, mechanical
[HAIKU] KERNL migration: CREATE budget_config table → DDL specified, mechanical
[HAIKU] Write pricing.yaml (model pricing table) → content specified below, mechanical file write
[HAIKU] Write cost-calculator.ts (calculateCost from token counts + model) → formula specified, mechanical
[HAIKU] CostTicker React component: display only, props specified → mechanical
[HAIKU] DailyBurnBadge React component: display only, props specified → mechanical
[HAIKU] Run npx tsc --noEmit + capture errors → mechanical
[HAIKU] SESSION END: Update STATUS.md sprint 7D complete, write SPRINT_7D_COMPLETE.md, git commit message, git add/commit -F/push
[SONNET] cost-tracker.ts: consume SDK usage events, write session_costs incrementally, emit cost update events
[SONNET] budget-enforcer.ts: soft cap (warn at 80%), hard daily cap (block new spawns), kill switch integration
[SONNET] Modify query.ts (7A) to wire cost-tracker into the event loop
[SONNET] Cost rollup queries: per-session total, per-project rollup, daily total
[SONNET] BudgetCapAlert component: modal when soft cap hit, block UI when hard cap hit
[OPUS] Escalation only if Sonnet fails twice on same problem

QUALITY GATES:
1. Token usage captured from every SDK usage event and written to session_costs
2. estimated_cost_usd calculated correctly using pricing.yaml rates
3. session_costs updated on every checkpoint (every 5 tool calls or 60s, same cadence as job_state)
4. Soft cap ($2.00 default): warning emitted at 80% ($1.60) - session continues
5. Hard daily cap ($15.00 default): new session spawns blocked until David confirms override
6. Kill switch: aborts session immediately, cost at time of kill preserved in session_costs
7. pricing.yaml change → cost calculation updates without code change
8. pnpm test:run zero failures

FILE LOCATIONS:
  app/lib/agent-sdk/
    cost-tracker.ts       - consume usage events, write session_costs, emit cost updates
    cost-calculator.ts    - calculateCost(inputTokens, outputTokens, model) → USD
    budget-enforcer.ts    - soft/hard cap enforcement, daily total tracking

  app/components/agent-sdk/
    CostTicker.tsx        - live cost display during session (updates in real time)
    DailyBurnBadge.tsx    - daily spend in status bar
    BudgetCapAlert.tsx    - soft cap warning + hard cap block modal

  app/lib/agent-sdk/pricing.yaml  - model pricing table

SESSION_COSTS TABLE:
  CREATE TABLE IF NOT EXISTS session_costs (
    manifest_id TEXT PRIMARY KEY REFERENCES manifests(id),
    session_type TEXT,
    model TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    estimated_cost_usd REAL DEFAULT 0,
    project_id TEXT,
    started_at INTEGER,
    completed_at INTEGER,
    updated_at INTEGER NOT NULL
  );

BUDGET_CONFIG TABLE:
  CREATE TABLE IF NOT EXISTS budget_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  Default rows (INSERT OR IGNORE):
    ('session_soft_cap_usd', '2.00', ...)
    ('session_hard_cap_usd', '10.00', ...)
    ('daily_hard_cap_usd', '15.00', ...)

David can update these via Settings UI (stub the settings route in this sprint, full UI in 7F).

PRICING.YAML FORMAT:
  models:
    claude-sonnet-4-5:
      input_per_million: 3.00
      output_per_million: 15.00
    claude-opus-4-5:
      input_per_million: 15.00
      output_per_million: 75.00
    claude-haiku-4-5-20251001:
      input_per_million: 0.80
      output_per_million: 4.00

Read this file at startup and cache in memory. Reload if file changes (use fs.watch or a manual reload endpoint). No hardcoded prices anywhere in TypeScript.

COST CALCULATOR:
  export function calculateCost(inputTokens: number, outputTokens: number, model: string): number {
    const rates = getPricingForModel(model);   // reads from cached pricing.yaml
    return (inputTokens / 1_000_000 * rates.input_per_million)
         + (outputTokens / 1_000_000 * rates.output_per_million);
  }

DAILY TOTAL PERSISTENCE:
Daily total must survive app restarts. Store as a sum query over session_costs WHERE started_at >= start of today (UTC). Do not maintain a separate daily counter - derive it from session_costs on demand. On each new session spawn check, run the daily total query.

SOFT CAP BEHAVIOR:
When session cost crosses 80% of session_soft_cap_usd:
- Emit a warning event (consumed by CostTicker and job queue)
- Do NOT stop the session
- Show: "Session cost approaching limit ($X.XX / $Y.YY)"

HARD DAILY CAP BEHAVIOR:
When daily total >= daily_hard_cap_usd:
- Block new session spawns: spawnSession() returns error "Daily budget cap reached ($15.00). Confirm override to continue."
- Show BudgetCapAlert modal with cap amount, today's spend, [Override for Today] button
- [Override for Today]: sets a daily override flag in budget_config (expires at midnight UTC), allows spawns until then
- Running sessions are NOT killed - only new spawns are blocked

SESSION END:
1. npx tsc --noEmit - zero errors
2. pnpm test:run - zero failures
3. Update STATUS.md - Sprint 7D complete
4. git commit -F .git\COMMIT_MSG_TEMP (message: sprint-7d: cost accounting, session_costs, budget caps, pricing.yaml)
5. git push
6. Write SPRINT_7D_COMPLETE.md: cost calculation verified against known token counts, soft/hard cap triggers tested, pricing.yaml reload tested, daily total query verified across restart simulation

GATES CHECKLIST:
- session_costs row created on session spawn, updated on each checkpoint
- calculateCost() matches expected USD for known input/output token counts
- pricing.yaml drives all cost calculations (no hardcoded prices)
- Soft cap warning fires at 80% of session_soft_cap_usd, session continues
- Hard daily cap blocks new spawns, running sessions unaffected
- Override for Today works: sets flag, expires at midnight UTC
- Kill switch preserves cost at time of kill in session_costs
- Daily total derived from session_costs query (not separate counter)
- CostTicker updates in real time during session
- DailyBurnBadge shows correct daily total
- pnpm test:run clean
- Commit pushed via cmd -F flag
