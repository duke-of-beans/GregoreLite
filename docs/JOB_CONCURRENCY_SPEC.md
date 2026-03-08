# Job Concurrency Architecture Spec
**Status:** Design — pre-sprint
**Author:** David Kirsch / Claude synthesis
**Date:** March 2026
**Relates to:** `lib/agent-sdk/config.ts`, `priority-config.ts`, `scheduler.ts`, `budget-enforcer.ts`

---

## Problem

`MAX_CONCURRENT_SESSIONS = 8` is arbitrary. It's hardcoded in two places, not surfaced to the user as configurable, has no relationship to the user's actual API tier or machine resources, and has no special behavior for headless/automation modes. When customers hit it, they see silent queuing with no explanation of why or what they can do about it.

---

## Design Goals

1. **Sensible default** — conservative enough to not surprise a new user, high enough to not frustrate a power user
2. **User-configurable ceiling** — let customers grow it, but educate them on what they're trading off
3. **API tier awareness** — hard cap at Anthropic's actual limits, not an arbitrary number
4. **Headless mode override** — automation/CI mode gets full API headroom, no artificial ceiling
5. **Real-time feedback** — show resource load context when the user changes the setting

---

## Concurrency Defaults by Mode

### Standard (Interactive) Mode
The bottleneck for interactive use is not API rate limits — it's the user's attention and machine I/O. Each concurrent job opens a streaming connection, polls for output, and writes to SQLite. On a typical dev machine:

- **Default: 3 concurrent jobs**
  Enough to run a code job, a test job, and a research job simultaneously without thrashing. Matches what a developer can meaningfully monitor at once.
- **User ceiling: 10**
  Beyond 10, the UI job list becomes unreadable and machine I/O pressure is significant. This is a soft UX ceiling, not a technical one.
- **Absolute ceiling: API tier limit** (see below)

### Headless / Automation Mode
When running without a UI (CLI invocation, CI pipeline, scheduled automation):

- **No artificial ceiling** — use full API tier headroom
- Governed entirely by token rate limiter (already implemented in `rate-limiter.ts`) and the daily cost cap
- Headless mode detection: `process.env.GREGLITE_HEADLESS === 'true'` OR Tauri window not present

---

## API Tier Hard Caps

Anthropic's limits are per-organization and tier-based. The relevant axis for concurrency is **requests per minute (RPM)**, not concurrent sessions directly — but in practice, each active job makes ~1 request every 2–10 seconds during active streaming. This translates to a rough concurrent session ceiling.

| Tier | RPM (Sonnet) | Implied safe concurrent jobs* | Notes |
|------|-------------|-------------------------------|-------|
| Tier 1 | 50 RPM | ~4–8 | Entry, $5 deposit |
| Tier 2 | 1,000 RPM | ~50+ | Most indie devs |
| Tier 3 | 2,000 RPM | 100+ | Production apps |
| Tier 4 | 4,000 RPM | 200+ | Enterprise |

*Assumes one API call per job per 6–12 seconds (streaming checkpoint cadence). In practice, token limits (ITPM/OTPM) bite before RPM does.

**The real constraint is ITPM (input tokens per minute).** With prompt caching active (which GregLite uses), cached tokens don't count toward ITPM. Each job uses roughly 2,000–8,000 uncached input tokens per minute depending on context. At Tier 1 (20,000 ITPM), that's 3–10 jobs. At Tier 2 (200,000+ ITPM), the ceiling is effectively infinite for practical use.

### Implementation: Dynamic API Cap
Rather than hardcoding tier limits, read them from the API response headers on every request:
- `anthropic-ratelimit-requests-remaining`
- `anthropic-ratelimit-tokens-remaining`

Store the most recent values in a lightweight in-memory cache. When remaining capacity drops below 20%, throttle new spawns. This is more accurate than any static tier table and automatically adapts as Anthropic adjusts limits.

The existing `rate-limiter.ts` token bucket already handles ITPM throttling. RPM awareness needs to be added.

---

## Settings UI Design

### Location
`Settings → Jobs → Concurrency`

### Controls

**Max Concurrent Jobs** — slider or stepper, range 1–10 (interactive mode)
- Default: 3
- Each increment shows an inline resource load indicator (see below)
- Value persists to `budget_config` table as `max_concurrent_sessions`

**Resource Load Indicator** (shown inline as slider moves)
At each value, display a plain-language impact summary:

| Value | Label | Copy |
|-------|-------|------|
| 1–2 | Conservative | One job at a time. Minimal system load. |
| 3–4 | Balanced | Good for parallel work without overloading your machine. Recommended. |
| 5–7 | Aggressive | Higher memory and CPU use. Monitor AEGIS during heavy sprints. |
| 8–10 | Maximum | Near API rate limits. Expect queuing if jobs are long-running. |

**API Tier note** (read-only, below slider)
"Your API tier supports up to ~N concurrent jobs before rate limiting. GregLite will queue additional jobs automatically."
(N derived from live header data or estimated from current observed RPM headroom.)

**Headless Mode** — toggle, default off
"When enabled, job concurrency limits are removed. GregLite uses full API headroom. Intended for CI pipelines and overnight automation runs."
Warning shown when toggled on: "Headless mode can consume your daily budget faster. Current daily cap: $X."

---

## Code Changes Required

### 1. `priority-config.ts`
Remove hardcoded `MAX_CONCURRENT_SESSIONS = 8`. Replace with a function:
```ts
export function getMaxConcurrentSessions(): number {
  if (isHeadlessMode()) return Infinity; // governed by rate limiter only
  return getBudgetConfigNumber('max_concurrent_sessions', 3); // default 3, not 8
}
```

### 2. `scheduler.ts`
Replace all references to `MAX_CONCURRENT_SESSIONS` constant with `getMaxConcurrentSessions()` call. Already reads from DB for budget values — same pattern.

### 3. `rate-limiter.ts`
Add RPM tracking alongside existing token bucket:
- Track request timestamps in a 60s rolling window (same pattern as tokens)
- Expose `isRpmThrottled(): boolean` and `getRpmUsageRatio(): number`
- Throttle new spawns when RPM usage > 80% (same threshold as ITPM)

### 4. `config.ts`
Update `AGENT_COST_CONFIG.maxConcurrentSessions` default from 8 → 3.

### 5. `BudgetSettingsPanel.tsx` (or new `ConcurrencySettingsPanel.tsx`)
Add the concurrency slider UI described above. Show resource load copy inline. Add headless toggle. Read/write via `/api/agent-sdk/budget` endpoint or new `/api/agent-sdk/config` endpoint.

### 6. `JobQueue.tsx`
Update the `{activeJobs.length}/8` display to read the actual configured max:
```tsx
{activeJobs.length}/{maxConcurrent === Infinity ? '∞' : maxConcurrent}
```
When headless mode is active, show `∞` (or "headless") instead of a number.

---

## Headless Mode Detection

```ts
export function isHeadlessMode(): boolean {
  // Explicit env var (CI/automation)
  if (process.env.GREGLITE_HEADLESS === 'true') return true;
  // User-configured via Settings toggle
  return getBudgetConfigString('headless_mode') === 'true';
}
```

Tauri window detection can be added as a third signal if needed, but env var + DB flag covers the primary use cases.

---

## What Does NOT Change

- Daily cost cap ($15 default) — unchanged, applies in all modes
- Token rate limiter — unchanged, primary guard in headless mode
- Strategic thread bypass — unchanged, always bypasses queue
- Priority ordering — unchanged

---

## Sprint Estimate

This is 1 sprint, low-to-medium complexity. The scheduler change is mechanical (constant → function call). The rate limiter RPM addition is ~50 lines. The settings UI is the most effort — the slider + inline copy pattern doesn't exist yet but is straightforward.

Suggested sprint: **Sprint 34.0** (after bug hardening in 33.0).
