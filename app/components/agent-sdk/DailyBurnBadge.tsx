'use client';

/**
 * DailyBurnBadge — Phase 7D
 *
 * Shows today's total agent spend in the status bar.
 * Derived from the session_costs SQL query via getDailyTotalUsd() —
 * parent fetches and passes the value so this stays a pure display component.
 *
 * Colour coding:
 *   green   — < 50% of daily cap
 *   amber   — 50–80% of daily cap
 *   red     — > 80% of daily cap  (plus pulsing dot)
 *
 * BLUEPRINT §4.3.5
 */



export interface DailyBurnBadgeProps {
  /** Today's total spend in USD — derived from session_costs SUM query */
  dailyTotalUsd: number;
  /** Daily hard cap in USD (from budget_config) */
  dailyCapUsd: number;
  /** Whether a David-granted daily override is currently active */
  overrideActive?: boolean;
}

function formatUsd(usd: number): string {
  if (usd < 0.01) return '$0.00';
  return `$${usd.toFixed(2)}`;
}

export function DailyBurnBadge({
  dailyTotalUsd,
  dailyCapUsd,
  overrideActive = false,
}: DailyBurnBadgeProps) {
  const pct = dailyCapUsd > 0 ? dailyTotalUsd / dailyCapUsd : 0;

  const colour =
    pct >= 0.8
      ? 'text-red-400 border-red-400/30 bg-red-400/10'
      : pct >= 0.5
        ? 'text-amber-400 border-amber-400/30 bg-amber-400/10'
        : 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-xs tabular-nums ${colour}`}
      title={`Daily spend: ${formatUsd(dailyTotalUsd)} of ${formatUsd(dailyCapUsd)} cap${overrideActive ? ' (override active)' : ''}`}
    >
      {pct >= 0.8 && (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      )}
      {formatUsd(dailyTotalUsd)}
      <span className="opacity-40">/day</span>
      {overrideActive && (
        <span className="ml-0.5 text-amber-300 opacity-70" title="Override for Today active">
          ↑
        </span>
      )}
    </span>
  );
}
