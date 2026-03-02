'use client';

/**
 * CostTicker — Phase 7D
 *
 * Live cost display for an active agent session.
 * Shown inline in the job queue row during a running session.
 * Updates in real time as StreamEvents arrive from the parent.
 *
 * Props are intentionally simple — the parent passes current cost values;
 * this component is pure display with no DB access of its own.
 *
 * BLUEPRINT §4.3.5
 */



export interface CostTickerProps {
  /** Current estimated cost in USD for this session */
  costUsd: number;
  /** Soft-cap limit in USD (from budget_config) — used to colour the ticker */
  softCapUsd: number;
  /** Whether the session is still running (false = dim/static display) */
  isRunning: boolean;
  /** Input tokens consumed so far */
  inputTokens?: number;
  /** Output tokens consumed so far */
  outputTokens?: number;
}

function formatUsd(usd: number): string {
  if (usd < 0.001) return '$0.00';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function CostTicker({
  costUsd,
  softCapUsd,
  isRunning,
  inputTokens = 0,
  outputTokens = 0,
}: CostTickerProps) {
  const pct = softCapUsd > 0 ? costUsd / softCapUsd : 0;

  // Colour thresholds: green → amber at 80% → red at 100%
  const colour =
    pct >= 1.0
      ? 'text-red-400'
      : pct >= 0.8
        ? 'text-amber-400'
        : 'text-emerald-400';

  const dimmed = !isRunning ? 'opacity-60' : '';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-xs tabular-nums ${colour} ${dimmed}`}
      title={`Input: ${formatTokens(inputTokens)} tokens  Output: ${formatTokens(outputTokens)} tokens`}
    >
      {isRunning && (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      )}
      {formatUsd(costUsd)}
      {softCapUsd > 0 && (
        <span className="opacity-50">/ {formatUsd(softCapUsd)}</span>
      )}
    </span>
  );
}
