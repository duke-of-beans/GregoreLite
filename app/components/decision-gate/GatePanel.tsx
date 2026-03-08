'use client';
import { apiFetch } from '@/lib/api-client';

/**
 * GatePanel — non-modal Decision Gate panel (Blueprint §8, Sprint 18.0)
 *
 * Slides in above the input field when a trigger fires.
 * Pushes the input down — does NOT cover the conversation.
 * David can still read the full thread context while deciding.
 *
 * States:
 *   Normal (dismissCount < 3): Three-choice radio + Proceed / Not now
 *   Mandatory (dismissCount >= 3): Approve + Override form (≥20 char rationale)
 *
 * Three choices (Sprint 18.0):
 *   Just this once     → creates 'once' policy (auto-deletes after next bypass)
 *   Always allow [...] → creates 'category' policy for this trigger type
 *   Never warn again   → creates 'always' policy (permanent bypass)
 *
 * Proceed → POST /api/decision-gate/policy (if non-once) + POST /api/decision-gate/approve
 * Not now → POST /api/decision-gate/dismiss → may releaseLock or go mandatory
 * Override → POST /api/decision-gate/override → releaseLock → clearTrigger
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GateTrigger, TriggerResult } from '@/lib/decision-gate';
import { useDecisionGateStore } from '@/lib/stores/decision-gate-store';
import { shouldInterrupt, onQueueDrain } from '@/lib/focus/interrupt-gate';
import { ContradictionView } from './ContradictionView';
import { MandatoryOverlay } from './MandatoryOverlay';
import { panelSlideUp } from '@/lib/design/animations';

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
  // Sprint 19.0 — Law 1/3/5 enforcement triggers
  append_only_violation: 'Append-Only Violation',
  reversibility_missing: 'Reversibility Gap',
  deep_work_interruption: 'Deep Work Guard',
};

type PolicyScope = 'once' | 'category' | 'always';

export function GatePanel({ threadId, trigger }: GatePanelProps) {
  const { dismissCount, setDismissCount, clearTrigger } = useDecisionGateStore();
  const [proceeding, setProceeding] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sprint 18.0: three-choice policy scope
  const [policyScope, setPolicyScope] = useState<PolicyScope>('once');

  // Sprint 19.0 — Law 5: check interrupt gate before rendering.
  // Critical gates (sacred_principle_risk) always pass. Others queue during deep work.
  const interruptId = useRef(`gate-${trigger.trigger ?? 'unknown'}-${Date.now()}`);
  const [show, setShow] = useState<boolean>(() => {
    if (!trigger.trigger) return true;
    const isCritical = trigger.trigger === 'sacred_principle_risk';
    return shouldInterrupt({
      type: 'gate',
      severity: isCritical ? 'critical' : 'high',
      message: trigger.reason,
      id: interruptId.current,
    });
  });

  // Release gate when focus drops and interrupt queue drains
  useEffect(() => {
    if (show) return;
    return onQueueDrain((released) => {
      if (released.some((r) => r.id === interruptId.current)) {
        setShow(true);
      }
    });
  }, [show]);

  const mandatory = dismissCount >= 3;
  const dismissesLeft = Math.max(0, 3 - dismissCount);
  const label = trigger.trigger ? TRIGGER_LABELS[trigger.trigger] : 'Review Required';

  /**
   * Proceed: optionally create an override policy, then approve the gate.
   * All three scopes create a policy — 'once' auto-deletes after next bypass.
   */
  const handleProceed = async () => {
    if (!trigger.trigger) return;
    setProceeding(true);
    setError(null);

    try {
      // Create the override policy for the selected scope
      const policyRes = await apiFetch('/api/decision-gate/policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger: trigger.trigger,
          scope: policyScope,
          // 'category' scope uses the trigger type as category key
          category: policyScope === 'category' ? trigger.trigger : undefined,
        }),
      });

      if (!policyRes.ok) {
        const data = await policyRes.json() as { error?: string };
        setError(data.error ?? 'Failed to save policy');
        return;
      }

      // Approve the gate
      const approveRes = await apiFetch('/api/decision-gate/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, trigger: trigger.trigger }),
      });

      if (!approveRes.ok) {
        const data = await approveRes.json() as { error?: string };
        setError(data.error ?? 'Approval failed');
        return;
      }

      clearTrigger();
    } catch {
      setError('Network error — try again');
    } finally {
      setProceeding(false);
    }
  };

  /** Not now: dismiss gate (increments counter; mandatory at 3). */
  const handleNotNow = async () => {
    setDismissing(true);
    setError(null);

    try {
      const res = await apiFetch('/api/decision-gate/dismiss', { method: 'POST' });
      const data = await res.json() as {
        released: boolean;
        mandatory: boolean;
        dismissCount: number;
      };

      if (data.released) {
        clearTrigger();
      } else {
        setDismissCount(data.dismissCount);
      }
    } catch {
      setError('Network error — try again');
    } finally {
      setDismissing(false);
    }
  };

  // Approve path still used by mandatory overlay's approve button
  const handleApprove = async () => {
    if (!trigger.trigger) return;
    setProceeding(true);
    setError(null);
    try {
      const res = await apiFetch('/api/decision-gate/approve', {
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
      setProceeding(false);
    }
  };

  return (
    <AnimatePresence>
      {/* Suppressed until interrupt gate allows it (Law 5) */}
      {show && (
    <motion.div
      key="gate-panel"
      variants={panelSlideUp}
      initial="hidden"
      animate="visible"
      exit="exit"
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

        {/* Sprint 18.0: Three-choice policy radio + Proceed / Not now */}
        {!mandatory && (
          <div className="mt-4 space-y-3">
            <p className="text-xs font-medium text-[var(--mist)] uppercase tracking-wide">
              How should I handle this?
            </p>

            {/* Radio options */}
            <div className="space-y-2">
              {(
                [
                  { value: 'once',     label: 'Just this once' },
                  { value: 'category', label: `Always allow ${label}` },
                  { value: 'always',   label: 'Never warn about this again' },
                ] as const
              ).map(({ value, label: optLabel }) => (
                <label
                  key={value}
                  className="flex items-center gap-2.5 cursor-pointer group"
                >
                  <input
                    type="radio"
                    name="gate-policy-scope"
                    value={value}
                    checked={policyScope === value}
                    onChange={() => setPolicyScope(value)}
                    className="accent-[var(--cyan)] cursor-pointer"
                  />
                  <span className="text-sm text-[var(--frost)] group-hover:text-[var(--ice-white)] transition-colors">
                    {optLabel}
                  </span>
                </label>
              ))}
            </div>

            {/* Proceed / Not now */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => void handleProceed()}
                disabled={proceeding || dismissing}
                className="rounded px-4 py-1.5 text-sm font-medium bg-[var(--cyan)] text-[var(--deep-space)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {proceeding ? 'Proceeding…' : 'Proceed'}
              </button>
              <button
                onClick={() => void handleNotNow()}
                disabled={proceeding || dismissing}
                className="rounded border border-[var(--shadow)] px-4 py-1.5 text-sm font-medium text-[var(--mist)] transition-colors hover:border-[var(--cyan)] hover:text-[var(--frost)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {dismissing ? 'Dismissing…' : `Not now (${dismissesLeft} left)`}
              </button>
            </div>
          </div>
        )}

        {/* Mandatory approve button — still available alongside override */}
        {mandatory && (
          <div className="mt-3">
            <button
              onClick={() => void handleApprove()}
              disabled={proceeding}
              className="rounded px-4 py-1.5 text-sm font-medium bg-[var(--cyan)] text-[var(--deep-space)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {proceeding ? 'Approving…' : 'Approve & Continue'}
            </button>
          </div>
        )}
      </div>
    </motion.div>
      )}
    </AnimatePresence>
  );
}
