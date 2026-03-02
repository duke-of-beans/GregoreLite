/**
 * budget-enforcer.ts — Phase 7D
 *
 * Enforces per-session soft caps and daily hard caps on agent spend.
 *
 * SOFT CAP (session_soft_cap_usd, default $2.00):
 *   - At 80% → emit warning, session continues
 *   - At 100% → emit stronger warning, session still continues
 *   Running sessions are NEVER killed by a soft cap.
 *
 * HARD DAILY CAP (daily_hard_cap_usd, default $15.00):
 *   - spawnSession() is blocked when today's total >= cap
 *   - Running sessions are NOT killed
 *   - David can grant an "Override for Today" which expires at midnight UTC
 *
 * Daily total is derived from a SQL SUM over session_costs.started_at — it
 * survives app restarts automatically, no separate counter is maintained.
 *
 * All thresholds live in the budget_config DB table so David can adjust them
 * via the Settings UI (stubbed in 7F) without a code change.
 *
 * BLUEPRINT §4.3.5
 */

import { getDatabase } from '../kernl/database';

// ─── Budget config accessors ──────────────────────────────────────────────────

/**
 * Read a numeric value from budget_config with a safe fallback.
 */
export function getBudgetConfigNumber(key: string, fallback: number): number {
  try {
    const db = getDatabase();
    const row = db.prepare('SELECT value FROM budget_config WHERE key = ?').get(key) as { value: string } | undefined;
    if (!row) return fallback;
    const v = parseFloat(row.value);
    return isNaN(v) ? fallback : v;
  } catch {
    return fallback;
  }
}

/**
 * Read a string value from budget_config (returns null if missing).
 */
export function getBudgetConfigString(key: string): string | null {
  try {
    const db = getDatabase();
    const row = db.prepare('SELECT value FROM budget_config WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Write or update a budget_config entry.
 */
export function setBudgetConfig(key: string, value: string): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO budget_config (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value, Date.now());
}

// ─── Start of today (UTC midnight) ───────────────────────────────────────────

export function startOfTodayUtcMs(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

// End of today UTC (midnight of the next day) — used for override expiry
export function endOfTodayUtcMs(): number {
  return startOfTodayUtcMs() + 86_400_000; // +24 hours
}

// ─── Daily total ──────────────────────────────────────────────────────────────

/**
 * Return the sum of estimated_cost_usd for all sessions that started today (UTC).
 * Derived from session_costs — survives app restarts, no separate counter needed.
 */
export function getDailyTotalUsd(): number {
  try {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT COALESCE(SUM(estimated_cost_usd), 0) AS total
      FROM session_costs
      WHERE started_at >= ?
    `).get(startOfTodayUtcMs()) as { total: number } | undefined;
    return row?.total ?? 0;
  } catch {
    return 0;
  }
}

// ─── Daily override ───────────────────────────────────────────────────────────

/**
 * Check whether David has granted an "Override for Today".
 * The override is stored as an expiry timestamp in budget_config.
 */
export function isDailyOverrideActive(): boolean {
  const val = getBudgetConfigString('daily_override_expires_at');
  if (!val) return false;
  const expiry = parseInt(val, 10);
  if (isNaN(expiry)) return false;
  return Date.now() < expiry;
}

/**
 * Grant "Override for Today" — allows new session spawns until midnight UTC.
 * Called when David clicks [Override for Today] in BudgetCapAlert.
 */
export function setDailyOverride(): void {
  setBudgetConfig('daily_override_expires_at', String(endOfTodayUtcMs()));
}

/**
 * Clear the daily override (e.g. on new day).
 */
export function clearDailyOverride(): void {
  setBudgetConfig('daily_override_expires_at', '0');
}

// ─── Hard daily cap check ─────────────────────────────────────────────────────

/**
 * Returns true when today's total spend has reached the hard daily cap AND
 * no active override exists.
 *
 * Call this before spawnSession() — blocks new spawns, does NOT kill running sessions.
 */
export function isDailyCapReached(): boolean {
  if (isDailyOverrideActive()) return false;
  const dailyCap = getBudgetConfigNumber('daily_hard_cap_usd', 15.00);
  const dailyTotal = getDailyTotalUsd();
  return dailyTotal >= dailyCap;
}

export interface DailyCapStatus {
  reached: boolean;
  dailyTotalUsd: number;
  dailyCapUsd: number;
  overrideActive: boolean;
}

/**
 * Full daily cap status snapshot — used by BudgetCapAlert.
 */
export function getDailyCapStatus(): DailyCapStatus {
  const dailyCapUsd = getBudgetConfigNumber('daily_hard_cap_usd', 15.00);
  const dailyTotalUsd = getDailyTotalUsd();
  const overrideActive = isDailyOverrideActive();
  return {
    reached: !overrideActive && dailyTotalUsd >= dailyCapUsd,
    dailyTotalUsd,
    dailyCapUsd,
    overrideActive,
  };
}
