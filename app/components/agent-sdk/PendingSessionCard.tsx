/**
 * PendingSessionCard — Sprint 7F
 *
 * Shown when status === 'pending' (session queued, waiting for a slot).
 * Displays queue position, task type, and a [Cancel] button that calls
 * POST /api/agent-sdk/jobs/:id/kill (which also handles pending cancellation
 * via scheduler.cancel()).
 */

'use client';

import { useState } from 'react';
import type { AgentJobView } from './types';

const TASK_TYPE_LABELS: Record<string, string> = {
  code:           'Code',
  test:           'Test',
  docs:           'Docs',
  research:       'Research',
  analysis:       'Analysis',
  deploy:         'Deploy',
  self_evolution: 'Self-Evolution',
};

interface PendingSessionCardProps {
  job: AgentJobView;
  totalPending: number; // used for estimated wait label
  onCancelled: () => void;
}

export function PendingSessionCard({ job, totalPending, onCancelled }: PendingSessionCardProps) {
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const position = job.queuePosition ?? 1;
  const typeLabel = TASK_TYPE_LABELS[job.taskType] ?? job.taskType;

  async function handleCancel() {
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent-sdk/jobs/${job.manifestId}/kill`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        // 404 means already dequeued — treat as success
        if (res.status !== 404) {
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
      }
      onCancelled();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
      setCancelling(false);
    }
  }

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        marginBottom: '8px',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px 6px' }}>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: '#94a3b8',
            background: 'color-mix(in srgb, #94a3b8 15%, var(--bg))',
            borderRadius: '3px',
            padding: '1px 5px',
            flexShrink: 0,
          }}
        >
          #{position}
        </span>
        <span
          style={{
            flex: 1,
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--frost)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={job.title}
        >
          {job.title}
        </span>
        <span style={{ fontSize: '9px', color: '#94a3b8', flexShrink: 0 }}>PENDING</span>
      </div>

      {/* ── Wait info ────────────────────────────────────────────────────── */}
      <div style={{ padding: '0 12px 6px', fontSize: '10px', color: 'var(--mist)' }}>
        Waiting for slot · Priority: {typeLabel}
        {totalPending > 1 && (
          <span> · ~{position - 1} session{position - 1 !== 1 ? 's' : ''} ahead</span>
        )}
      </div>

      {error && (
        <div style={{ padding: '2px 12px 4px', fontSize: '10px', color: '#ef4444' }}>
          {error}
        </div>
      )}

      {/* ── Cancel ───────────────────────────────────────────────────────── */}
      <div style={{ padding: '4px 12px 10px' }}>
        <button
          onClick={handleCancel}
          disabled={cancelling}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            color: cancelling ? 'var(--mist)' : 'var(--frost)',
            cursor: cancelling ? 'not-allowed' : 'pointer',
            fontSize: '10px',
            padding: '4px 10px',
            opacity: cancelling ? 0.6 : 1,
          }}
        >
          {cancelling ? 'Cancelling…' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}
