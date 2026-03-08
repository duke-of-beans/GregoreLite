'use client';
import { apiFetch } from '@/lib/api-client';

/**
 * MandatoryOverlay — full-width banner when dismissCount >= 3
 *
 * Replaces the "Dismiss" button with an override form requiring
 * a written rationale of at least 20 characters. This override
 * is written to the KERNL decisions table before the lock releases.
 */

import { useState } from 'react';
import type { GateTrigger } from '@/lib/decision-gate';

interface MandatoryOverlayProps {
  threadId: string | null;
  trigger: GateTrigger;
  onOverrideComplete: () => void;
}

const MIN_RATIONALE_LENGTH = 20;

export function MandatoryOverlay({
  threadId,
  trigger,
  onOverrideComplete,
}: MandatoryOverlayProps) {
  const [rationale, setRationale] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = MIN_RATIONALE_LENGTH - rationale.length;
  const canSubmit = rationale.trim().length >= MIN_RATIONALE_LENGTH && !submitting;

  const handleOverride = async () => {
    if (!canSubmit || !threadId) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await apiFetch('/api/decision-gate/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, trigger, rationale: rationale.trim() }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? 'Override failed');
        return;
      }

      onOverrideComplete();
    } catch {
      setError('Network error — try again');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 rounded-md border border-red-500/40 bg-red-500/5 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-400">
        Mandatory Gate — Override requires written rationale
      </p>
      <textarea
        className="w-full resize-none rounded border border-[var(--shadow)] bg-[var(--deep-space)] p-2 text-sm text-[var(--ice-white)] placeholder-[var(--ghost-text)] focus:border-[var(--cyan)] focus:outline-none"
        rows={3}
        placeholder="Explain why you are overriding this gate..."
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        disabled={submitting}
      />
      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs text-[var(--ghost-text)]">
          {remaining > 0 ? `${remaining} more characters required` : 'Ready to submit'}
        </span>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
      <button
        onClick={() => void handleOverride()}
        disabled={!canSubmit}
        className="mt-2 w-full rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 bg-red-600 text-white hover:bg-red-500 disabled:hover:bg-red-600"
      >
        {submitting ? 'Overriding…' : 'Override Gate'}
      </button>
    </div>
  );
}
