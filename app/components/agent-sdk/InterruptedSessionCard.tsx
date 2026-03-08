'use client';
/**
 * InterruptedSessionCard — Sprint 7F
 *
 * Shown when status === 'interrupted'. Displays the failure reason from
 * last_event, lists files already written, and offers:
 *   [Restart with Handoff]  — calls POST /api/agent-sdk/jobs/:id/restart
 *   [Cancel]                — removes from the visible list (UI only)
 *
 * The restart creates a NEW manifest with the handoff report prepended;
 * the new session will appear in the job queue on the next poll.
 */


import { useState } from 'react';
import type { AgentJobView } from './types';

interface InterruptedSessionCardProps {
  job: AgentJobView;
  onDismiss: (manifestId: string) => void;
  onRestarted: () => void; // triggers queue refresh
  /** S9-11: Open ManifestBuilder pre-filled for edit & retry */
  onEditRetry?: (job: AgentJobView) => void;
}

export function InterruptedSessionCard({ job, onDismiss, onRestarted, onEditRetry }: InterruptedSessionCardProps) {
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract human-readable failure reason from last_event
  const lastEvent = job.lastEvent as Record<string, unknown> | null;
  const failureReason: string =
    (lastEvent?.message as string) ??
    (lastEvent?.context as string) ??
    'Session was interrupted';

  async function handleRestart() {
    setRestarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent-sdk/jobs/${job.manifestId}/restart`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      onRestarted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restart failed');
      setRestarting(false);
    }
  }

  return (
    <div
      style={{
        background: 'color-mix(in srgb, #f97316 6%, var(--surface))',
        border: '1px solid color-mix(in srgb, #f97316 30%, var(--border))',
        borderRadius: '6px',
        marginBottom: '8px',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px 6px' }}>
        <span style={{ fontSize: '12px', color: '#f97316' }}>⚠</span>
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
        <span style={{ fontSize: '9px', color: '#f97316', fontWeight: 600, flexShrink: 0 }}>
          INTERRUPTED
        </span>
      </div>

      {/* ── Failure reason ───────────────────────────────────────────────── */}
      <div style={{ padding: '0 12px 6px', fontSize: '10px', color: 'var(--mist)' }}>
        Stopped because: {failureReason}
      </div>

      {/* ── Files written ────────────────────────────────────────────────── */}
      {job.filesModified.length > 0 && (
        <div style={{ padding: '0 12px 6px', fontSize: '10px', color: 'var(--mist)' }}>
          Files written:{' '}
          <span style={{ color: 'var(--frost)' }}>
            {job.filesModified.slice(0, 4).join(', ')}
            {job.filesModified.length > 4 && ` +${job.filesModified.length - 4} more`}
          </span>
        </div>
      )}

      {/* ── Cost row ─────────────────────────────────────────────────────── */}
      <div style={{ padding: '0 12px 6px', fontSize: '10px', color: 'var(--mist)' }}>
        Cost: <span style={{ color: 'var(--frost)' }}>${job.costUsd.toFixed(4)}</span>
        {' · '}Steps: <span style={{ color: 'var(--frost)' }}>{job.stepsCompleted}</span>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div style={{ padding: '4px 12px', fontSize: '10px', color: '#ef4444' }}>
          {error}
        </div>
      )}

      {/* ── Action buttons ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', padding: '6px 12px 10px' }}>
        <button
          onClick={handleRestart}
          disabled={restarting}
          style={{
            background: restarting ? 'var(--surface)' : '#f97316',
            border: 'none',
            borderRadius: '4px',
            color: restarting ? 'var(--mist)' : '#000',
            cursor: restarting ? 'not-allowed' : 'pointer',
            fontSize: '11px',
            fontWeight: 600,
            padding: '5px 10px',
            opacity: restarting ? 0.6 : 1,
          }}
        >
          {restarting ? '↻ Restarting…' : '↻ Restart with Handoff'}
        </button>
        <button
          onClick={() => onDismiss(job.manifestId)}
          disabled={restarting}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            color: 'var(--mist)',
            cursor: 'pointer',
            fontSize: '11px',
            padding: '5px 10px',
          }}
        >
          Dismiss
        </button>
        {onEditRetry && (
          <button
            onClick={() => onEditRetry(job)}
            disabled={restarting}
            style={{
              background: 'none',
              border: '1px solid var(--accent)',
              borderRadius: '4px',
              color: 'var(--accent)',
              cursor: 'pointer',
              fontSize: '11px',
              padding: '5px 10px',
            }}
          >
            ✏ Edit &amp; Retry
          </button>
        )}
      </div>
    </div>
  );
}
