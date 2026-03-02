'use client';

/**
 * TriggerBadge — compact status bar indicator when the gate is active
 *
 * Shown in the Header right section. Clicking it scrolls/focuses
 * the GatePanel (parent handles via onFocus callback).
 * Displays "⚠ DECISION GATE" when a trigger is active.
 */

interface TriggerBadgeProps {
  onClick?: () => void;
}

export function TriggerBadge({ onClick }: TriggerBadgeProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border border-[var(--amber,#f59e0b)]/50 bg-[var(--amber,#f59e0b)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--amber,#f59e0b)] transition-colors hover:bg-[var(--amber,#f59e0b)]/20 animate-pulse"
      title="Decision Gate active — click to review"
      aria-label="Decision Gate active"
    >
      <span aria-hidden="true">⚠</span>
      <span>DECISION GATE</span>
    </button>
  );
}
