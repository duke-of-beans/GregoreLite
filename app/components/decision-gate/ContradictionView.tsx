'use client';

/**
 * ContradictionView — shown inside GatePanel when trigger === 'contradicts_prior'
 *
 * The trigger reason already contains the explanation from analyze() —
 * no additional API fetch needed. Displayed as a styled blockquote.
 */

interface ContradictionViewProps {
  reason: string;
}

export function ContradictionView({ reason }: ContradictionViewProps) {
  return (
    <div className="mt-2 rounded-md border border-[var(--amber,#f59e0b)]/30 bg-[var(--amber,#f59e0b)]/5 p-3">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--amber,#f59e0b)]">
        Prior KERNL decision may be affected
      </p>
      <p className="text-sm text-[var(--frost)]">{reason}</p>
    </div>
  );
}
