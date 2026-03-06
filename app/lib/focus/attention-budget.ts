/**
 * attention-budget.ts — Attention Budget Tracker — Sprint 19.0
 *
 * Law 10 (Attention is Scarce): 100 cognitive tokens (CT) per day.
 * Each interrupt type has a cost. When budget is exhausted, only critical
 * severity passes through. Budget auto-resets at midnight.
 *
 * Costs per Sacred Laws §10:
 *   ghost_suggestion surfaced  →  1 CT
 *   status_notification        →  3 CT
 *   gate_warning               →  5 CT
 *   gate_mandatory (veto)      → 10 CT
 *   critical_system_alert      → 25 CT
 *
 * State is module-level (transient). No persistent guilt across days.
 * The daily reset fires automatically at midnight via a scheduled timeout.
 *
 * BLUEPRINT SPRINT_19_0_BRIEF.md Tasks 7-8
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type AttentionSpendType =
  | 'ghost_suggestion'
  | 'status_notification'
  | 'gate_warning'
  | 'gate_mandatory'
  | 'critical_alert';

export interface AttentionSpend {
  type: AttentionSpendType;
  cost: number;
  timestamp: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const DAILY_BUDGET = 100; // cognitive tokens per day

export const ATTENTION_COSTS: Record<AttentionSpendType, number> = {
  ghost_suggestion:    1,
  status_notification: 3,
  gate_warning:        5,
  gate_mandatory:      10,
  critical_alert:      25,
};

// ─── Module state ────────────────────────────────────────────────────────────

let spendHistory: AttentionSpend[] = [];
let dailySpent = 0;
let resetTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Midnight reset scheduler ─────────────────────────────────────────────────

function msUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0, 0, 0, 0,
  );
  return midnight.getTime() - now.getTime();
}

function scheduleReset(): void {
  if (resetTimer !== null) clearTimeout(resetTimer);
  resetTimer = setTimeout(() => {
    resetDailyBudget();
    scheduleReset(); // reschedule for next midnight
  }, msUntilMidnight());
}

// Auto-start the reset scheduler when the module is loaded
scheduleReset();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * spendAttention — deduct tokens from the daily budget.
 * Returns false if the budget is already exhausted (caller should block the interrupt).
 * Returns true if the deduction was applied (interrupt is allowed).
 *
 * Budget exhaustion only blocks low/medium/high — critical always passes.
 */
export function spendAttention(type: AttentionSpendType): boolean {
  const cost = ATTENTION_COSTS[type];

  // Critical alert always passes — never blocked by budget
  if (type === 'critical_alert') {
    spendHistory.push({ type, cost, timestamp: Date.now() });
    dailySpent += cost;
    return true;
  }

  if (dailySpent >= DAILY_BUDGET) return false;

  dailySpent += cost;
  spendHistory.push({ type, cost, timestamp: Date.now() });
  return true;
}

/**
 * getAttentionRemaining — how many CT remain today.
 * Never negative.
 */
export function getAttentionRemaining(): number {
  return Math.max(0, DAILY_BUDGET - dailySpent);
}

/**
 * getAttentionHistory — list of all spends this session (since last midnight reset).
 */
export function getAttentionHistory(): AttentionSpend[] {
  return [...spendHistory];
}

/**
 * resetDailyBudget — clear spend state. Called automatically at midnight.
 * Can be called manually for testing.
 */
export function resetDailyBudget(): void {
  dailySpent = 0;
  spendHistory = [];
}

/**
 * getAttentionTooltip — formatted string for StatusBar tooltip.
 * Example: "Attention: 73/100 CT remaining"
 * Per Sacred Laws §10 "no badges" rule — shown in tooltip only, not as a visible bar.
 */
export function getAttentionTooltip(): string {
  const remaining = getAttentionRemaining();
  return `Attention: ${remaining}/${DAILY_BUDGET} CT remaining`;
}

/**
 * isBudgetExhausted — true when all non-critical attention is consumed.
 */
export function isBudgetExhausted(): boolean {
  return dailySpent >= DAILY_BUDGET;
}
