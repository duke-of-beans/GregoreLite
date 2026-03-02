'use client';

/**
 * BudgetCapAlert — Phase 7D
 *
 * Modal shown when the daily hard cap is reached or when a session
 * crosses the soft cap threshold.
 *
 * Modes:
 *   'soft'  — warning only, session continues.  Displayed inline (not modal).
 *   'hard'  — blocking modal.  New spawns are prevented until David confirms
 *             "Override for Today" or the day rolls over.
 *
 * The [Override for Today] button calls onOverride() which should invoke
 * budget-enforcer.setDailyOverride() on the server and then dismiss.
 * The override flag expires at midnight UTC — no manual clearing needed.
 *
 * Running sessions are NEVER affected — this only blocks NEW spawns.
 *
 * BLUEPRINT §4.3.5
 */

export interface BudgetCapAlertProps {
  mode: 'soft' | 'hard';
  /** Current session cost (soft mode) or daily total (hard mode) in USD */
  currentUsd: number;
  /** The cap that was hit in USD */
  capUsd: number;
  /** Called when David grants "Override for Today" (hard mode only) */
  onOverride?: () => void;
  /** Called when the alert is dismissed (soft mode, or after override) */
  onDismiss?: () => void;
}

function formatUsd(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

// ─── Soft cap inline warning ──────────────────────────────────────────────────

function SoftCapWarning({ currentUsd, capUsd, onDismiss }: {
  currentUsd: number;
  capUsd: number;
  onDismiss?: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-300">
      <span className="mt-0.5 text-base leading-none">⚠</span>
      <div className="flex-1">
        <span className="font-medium">Session cost approaching limit</span>
        <span className="ml-1 font-mono text-xs opacity-80">
          ({formatUsd(currentUsd)} / {formatUsd(capUsd)})
        </span>
        <p className="mt-0.5 text-xs opacity-70">
          The session will continue running. Adjust limits in Settings if needed.
        </p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 text-amber-400/60 hover:text-amber-300 transition-colors"
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ─── Hard cap blocking modal ──────────────────────────────────────────────────

function HardCapModal({ currentUsd, capUsd, onOverride, onDismiss }: {
  currentUsd: number;
  capUsd: number;
  onOverride?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="budget-cap-title"
    >
      <div className="w-full max-w-md rounded-lg border border-red-500/30 bg-neutral-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🛑</span>
          <h2 id="budget-cap-title" className="text-base font-semibold text-red-400">
            Daily Budget Cap Reached
          </h2>
        </div>

        {/* Body */}
        <p className="text-sm text-neutral-300 mb-2">
          New agent sessions are blocked until the daily limit resets or you grant a one-day override.
        </p>
        <div className="rounded border border-neutral-700 bg-neutral-800 px-3 py-2 font-mono text-sm mb-4">
          <div className="flex justify-between">
            <span className="text-neutral-400">Today&apos;s spend</span>
            <span className="text-red-400 font-medium">{formatUsd(currentUsd)}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-neutral-400">Daily cap</span>
            <span className="text-neutral-200">{formatUsd(capUsd)}</span>
          </div>
        </div>
        <p className="text-xs text-neutral-500 mb-5">
          Running sessions are unaffected. The cap resets automatically at midnight UTC.
          Override expires at midnight — no manual clearing required.
        </p>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="rounded px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200 border border-neutral-700 hover:border-neutral-500 transition-colors"
            >
              Cancel
            </button>
          )}
          {onOverride && (
            <button
              onClick={onOverride}
              className="rounded px-4 py-1.5 text-sm font-medium bg-amber-500 hover:bg-amber-400 text-black transition-colors"
            >
              Override for Today
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export function BudgetCapAlert({
  mode,
  currentUsd,
  capUsd,
  onOverride,
  onDismiss,
}: BudgetCapAlertProps) {
  if (mode === 'soft') {
    return (
      <SoftCapWarning
        currentUsd={currentUsd}
        capUsd={capUsd}
        {...(onDismiss ? { onDismiss } : {})}
      />
    );
  }
  return (
    <HardCapModal
      currentUsd={currentUsd}
      capUsd={capUsd}
      {...(onOverride ? { onOverride } : {})}
      {...(onDismiss ? { onDismiss } : {})}
    />
  );
}
