# Sprint 7D Complete — Cost Accounting

**Date:** March 2, 2026
**Tests:** 832/832 passing (39 files, +33 new tests)
**TSC:** 0 errors

---

## What Was Built

Sprint 7D adds full cost accounting to the Phase 7 Agent SDK. Every session's token spend is captured, persisted, and surfaced in the UI. Budget caps enforce spend limits with David as the only authority to override them.

---

## Cost Calculation Verified

Pricing.yaml drives all calculations — no hardcoded prices in TypeScript.

Sample verification:
- 1,000,000 input tokens + 1,000,000 output tokens, model `claude-sonnet-4-5`:
  - (1M / 1M × $3.00) + (1M / 1M × $15.00) = **$18.00** ✅
- 100,000 input + 50,000 output, model `claude-sonnet-4-5-20250929` (versioned key):
  - Strips date suffix → resolves to `claude-sonnet-4-5` rates
  - (0.1 × $3.00) + (0.05 × $15.00) = **$1.05** ✅
- Unknown model → returns $0.00, never crashes ✅

---

## Soft / Hard Cap Behaviour

**Soft cap (session_soft_cap_usd, default $2.00):**
- At 80% ($1.60): `getSessionCapStatus()` returns `warn`, cost event emitted, session continues
- At 100% ($2.00): returns `soft_cap`, session continues (never killed by soft cap)

**Hard daily cap (daily_hard_cap_usd, default $15.00):**
- `isDailyCapReached()` checked in `index.ts` before every `spawn()` call
- If blocked: throws `"Daily cost cap ($15.00) reached. No new sessions until cap resets."`
- Running sessions are NOT killed — only new spawns are blocked
- David clicks [Override for Today] → `setDailyOverride()` writes expiry at midnight UTC to `budget_config`
- Override expires automatically at next midnight UTC — no cleanup needed

---

## Daily Total Query

Daily total is derived from a SQL SUM over `session_costs.started_at`:

```sql
SELECT COALESCE(SUM(estimated_cost_usd), 0)
FROM session_costs
WHERE started_at >= <start_of_today_utc_ms>
```

No separate counter exists. Survives app restarts automatically. Verified in tests: mocked DB returns `{ total: 7.42 }` → `getDailyTotalUsd()` returns `7.42`.

---

## pricing.yaml Reload

`cost-calculator.ts` uses `fs.watch()` to bust the pricing cache automatically when `pricing.yaml` changes. No code change required for Anthropic price updates — edit the YAML file and costs recalculate on the next session spawn.

---

## Files Created / Modified

| File | Change |
|------|--------|
| `app/lib/kernl/schema.sql` | Added `session_costs` table + 2 indices, `budget_config` table + default rows |
| `app/lib/agent-sdk/pricing.yaml` | NEW — model pricing table (Haiku/Sonnet/Opus all versions) |
| `app/lib/agent-sdk/cost-calculator.ts` | NEW — `calculateCost()`, `getPricingForModel()`, inline YAML parser, `fs.watch` reload |
| `app/lib/agent-sdk/cost-tracker.ts` | NEW (rewrite of Phase 2A) — DB-backed `createSessionCost`, `updateSessionCost`, `finalizeSessionCost`; legacy `CostTracker` class retained for backward compat |
| `app/lib/agent-sdk/budget-enforcer.ts` | NEW — `isDailyCapReached()`, `getDailyTotalUsd()`, `setDailyOverride()`, `setBudgetConfig()` |
| `app/lib/agent-sdk/query.ts` | MODIFIED — `createSessionCost` on spawn, `updateSessionCost` on checkpoint, `finalizeSessionCost` on all terminal states, soft-cap warning event |
| `app/lib/agent-sdk/index.ts` | MODIFIED — `isDailyCapReached()` check before `spawn()` |
| `app/components/agent-sdk/CostTicker.tsx` | NEW — live cost bar with percentage fill |
| `app/components/agent-sdk/DailyBurnBadge.tsx` | NEW — status bar daily burn display |
| `app/components/agent-sdk/BudgetCapAlert.tsx` | NEW — soft cap warning + hard cap modal with Override button |
| `app/lib/agent-sdk/__tests__/cost-accounting.test.ts` | NEW — 33 tests across calculateCost, getPricingForModel, DB writes, cap status, daily total, override flow |

---

## Architecture Decisions

**Inline YAML parser** — No third-party YAML dependency. The pricing.yaml format is intentionally constrained (two-level structure, numeric values only), so a 40-line parser handles it cleanly. Keeps the bundle small and avoids a dependency version drift risk.

**Cumulative token writes** — `updateSessionCost` accepts cumulative totals (not deltas) so it can be called idempotently from any checkpoint without double-counting.

**Legacy CostTracker preserved** — `executor.ts` and `agent-sdk.test.ts` depend on the Phase 2A in-memory `CostTracker` class. Rather than breaking them, the class is retained and its `isDailyCapReached()` method now also consults the DB-backed budget-enforcer to account for Phase 7D sessions.

---

## Next Sprint

7E — Concurrency scheduler: max 8 parallel sessions, priority queue (strategic_thread > self_evolution > code > ghost), token bucket rate limiter, AEGIS profile transitions based on active session count.
