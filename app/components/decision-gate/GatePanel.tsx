'use client';

/**
 * GatePanel — non-modal Decision Gate panel (Blueprint §8)
 *
 * Slides in above the input field when a trigger fires.
 * Pushes the input down — does NOT cover the conversation.
 * David can still read the full thread context while deciding.
 *
 * States:
 *   Normal (dismissCount < 3): Approve + Dismiss buttons
 *   Mandatory (dismissCount >= 3): Approve + Override form (≥20 char rationale)
 *
 * Approve → POST /api/decision-gate/approve → releaseLock → clearTrigger
 * Dismiss → POST /api/decision-gate/dismiss → may releaseLock or go mandatory
 * Override → POST /api/decision-gate/override → releaseLock → clearTrigger
 */

import { useState } from 'react';
import type { GateTrigger, TriggerResult } from '@/lib/decision-gate';
import { useDecisionGateStore } from '@/lib/stores/decision-gate-store';
import { ContradictionView } from './ContradictionView';
import { MandatoryOverlay } from './MandatoryOverlay';

interface GatePanelProps {
  threadId: string | null;
  trigger: TriggerResult;
}

const TRIGGER_LABELS: Record<GateTrigger, string> = {
  repeated_question: 'Recurring Topic',
  high_tradeoff_count: 'Complex Decision',
  multi_project_touch: 'Cross-Project Impact',
  sacred_principle_risk: 'Shortcut Detected',
  irreversible_action: 'Irreversible',
  large_build_estimate: 'Large Scope',
  contradicts_prior: 'Contradicts Prior',
  low_confidence: 'Low Confidence',
};

export function GatePanel({ threadId, trigger }: GatePanelProps) {
  const { dismissCount, setDismissCount, clearTrigger } = useDecisionGateStore();
  const [approving, setApproving] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mandatory = dismissCount >= 3;
  const dismissesLeft = Math.max(0, 3 - dismissCount);
  const label = trigger.trigger ? TRIGGER_LABELS[trigger.trigger] : 'Review Required';

  const handleApprove = async () => {
    if (!trigger.trigger) return;
    setApproving(true);
    setError(null);

    try {
      const res = await fetch('/api/decision-gate/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, trigger: trigger.trigger }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? 'Approval failed');
        return;
      }

      clearTrigger();
    } catch {
      setError('Network error — try again');
    } finally {
      setApproving(false);
    }
  };

  const handleDismiss = async () => {
    setDismissing(true);
    setError(null);

    try {
      const res = await fetch('/api/decision-gate/dismiss', { method: 'POST' });
      const data = await res.json() as {
        released: boolean;
        mandatory: boolean;
        dismissCount: number;
      };

      if (data.released) {
        // Lock released — gate closes
        clearTrigger();
      } else {
        // Now mandatory — update count, keep panel open
        setDismissCount(data.dismissCount);
      }
    } catch {
      setError('Network error — try again');
    } finally {
      setDismissing(false);
    }
  };

  return (
    <div
      role="alertdialog"
      aria-label="Review Required"
      className="border-t border-[var(--amber,#f59e0b)]/40 bg-[var(--elevated)] px-6 py-4 flex-shrink-0"
    >
      <div className="mx-auto max-w-4xl">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[var(--amber,#f59e0b)]" aria-hidden="true">⚠</span>
            <span className="text-sm font-semibold text-[var(--ice-white)] uppercase tracking-wide">
              Review Required
            </span>
            <span className="rounded-full bg-[var(--amber,#f59e0b)]/20 px-2 py-0.5 text-xs text-[var(--amber,#f59e0b)]">
              {label}
            </span>
          </div>
        </div>

        {/* Trigger reason */}
        <p className="mb-3 text-sm text-[var(--frost)]">{trigger.reason}</p>

        {/* Contradiction detail view */}
        {trigger.trigger === 'contradicts_prior' && (
          <ContradictionView reason={trigger.reason} />
        )}

        {/* Error state */}
        {error && (
          <p className="mb-2 text-xs text-red-400">{error}</p>
        )}

        {/* Mandatory overlay — override form */}
        {mandatory && trigger.trigger && (
          <MandatoryOverlay
            threadId={threadId}
            trigger={trigger.trigger}
            onOverrideComplete={clearTrigger}
          />
        )}

        {/* Action buttons */}
        {!mandatory && (
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={() => void handleApprove()}
              disabled={approving || dismissing}
              className="rounded px-4 py-1.5 text-sm font-medium bg-[var(--cyan)] text-[var(--deep-space)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {approving ? 'Approving…' : 'Approve & Continue'}
            </button>
            <button
              onClick={() => void handleDismiss()}
              disabled={approving || dismissing}
              className="rounded border border-[var(--shadow)] px-4 py-1.5 text-sm font-medium text-[var(--mist)] transition-colors hover:border-[var(--cyan)] hover:text-[var(--frost)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {dismissing ? 'Dismissing…' : `Dismiss (${dismissesLeft} left)`}
            </button>
          </div>
        )}

        {/* Mandatory approve button — still available alongside override */}
        {mandatory && (
          <div className="mt-3">
            <button
              onClick={() => void handleApprove()}
              disabled={approving}
              className="rounded px-4 py-1.5 text-sm font-medium bg-[var(--cyan)] text-[var(--deep-space)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {approving ? 'Approving…' : 'Approve & Continue'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
