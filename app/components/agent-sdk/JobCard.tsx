/**
 * JobCard — Sprint 7F
 *
 * Single session card. Handles all non-INTERRUPTED, non-PENDING states.
 * (INTERRUPTED → InterruptedSessionCard, PENDING → PendingSessionCard)
 *
 * Layout per BLUEPRINT §4.3:
 *   [StatusBadge] [Title (truncated 60 chars)]           [Kill]
 *   Type: code | Steps: 12 | Files: 3 modified
 *   Cost: $0.43  [████████░░] 86% of $0.50 cap       Elapsed: 2m 14s
 *   [View Live Output ▼]
 *
 * For COMPLETED self_evolution:
 *   [View Output]  [Merge PR]  ← placeholder stub for 7H
 *
 * Kill button shows inline confirmation: [Kill? Confirm ✕] [× Cancel]
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { JobStatusBadge } from './JobStatusBadge';
import { LiveOutputPanel } from './LiveOutputPanel';
import type { AgentJobView } from './types';
import { KILLABLE_STATUSES, ACTIVE_STATUSES } from './types';

const TASK_ICONS: Record<string, string> = {
  code:           '⚙',
  test:           '✓',
  docs:           '✎',
  research:       '⌕',
  analysis:       '◎',
  deploy:         '⬆',
  self_evolution: '⟳',
};

function elapsedLabel(updatedAt: number): string {
  const s = Math.floor((Date.now() - updatedAt) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

interface JobCardProps {
  job: AgentJobView;
  softCapUsd: number;
  onKilled: () => void;
  /** S9-11: Open ManifestBuilder pre-filled for edit & retry */
  onEditRetry?: (job: AgentJobView) => void;
}

export function JobCard({ job, softCapUsd, onKilled, onEditRetry }: JobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmKill, setConfirmKill] = useState(false);
  const [killing, setKilling] = useState(false);
  const [killError, setKillError] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [merged, setMerged] = useState(false);
  const [elapsed, setElapsed] = useState(() => elapsedLabel(job.updatedAt));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isActive   = ACTIVE_STATUSES.has(job.status);
  const isKillable = KILLABLE_STATUSES.has(job.status);
  const isCompleted = job.status === 'completed';
  const isSelfEvolutionComplete = isCompleted && job.isSelfEvolution;

  // [Merge PR] button states (Sprint 7H)
  // ciPassed === null → CI still running / no repo config → show disabled "Awaiting CI…"
  // ciPassed === true → CI passed → show active "Merge PR ↑"
  // ciPassed === false → CI failed → show error state
  const mergeReady = isSelfEvolutionComplete && job.ciPassed === true && !merged;
  const mergeAwaitingCI = isSelfEvolutionComplete && job.prNumber !== null && job.ciPassed === null;
  const mergeCIFailed = isSelfEvolutionComplete && job.ciPassed === false;

  const icon = TASK_ICONS[job.taskType] ?? '·';

  // Live elapsed ticker for active sessions
  useEffect(() => {
    if (!isActive) return;
    timerRef.current = setInterval(() => {
      setElapsed(elapsedLabel(job.updatedAt));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive, job.updatedAt]);

  async function handleMergePR(e: React.MouseEvent) {
    e.stopPropagation();
    if (!mergeReady || merging) return;
    setMerging(true);
    setMergeError(null);
    try {
      const res = await fetch(`/api/agent-sdk/jobs/${job.manifestId}/merge`, {
        method: 'POST',
      });
      const body = await res.json() as { data?: { merged: boolean }; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (body.data?.merged) {
        setMerged(true);
        onKilled(); // trigger a refresh of the job list
      }
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : 'Merge failed');
    } finally {
      setMerging(false);
    }
  }

  async function handleConfirmKill() {
    setKilling(true);
    setKillError(null);
    try {
      const res = await fetch(`/api/agent-sdk/jobs/${job.manifestId}/kill`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      onKilled();
    } catch (err) {
      setKillError(err instanceof Error ? err.message : 'Kill failed');
      setKilling(false);
      setConfirmKill(false);
    }
  }

  // Cap progress bar — based on cost_so_far vs soft cap
  const capFraction = softCapUsd > 0
    ? Math.min(job.costSoFar / softCapUsd, 1)
    : 0;
  const capPct = Math.round(capFraction * 100);
  const capBarFilled = Math.round(capFraction * 10);
  const capBar = '█'.repeat(capBarFilled) + '░'.repeat(10 - capBarFilled);

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: `1px solid ${isActive ? 'var(--border)' : 'var(--border)'}`,
        borderRadius: '6px',
        marginBottom: '8px',
        overflow: 'hidden',
        cursor: 'pointer',
        opacity: isCompleted || job.status === 'failed' ? 0.8 : 1,
      }}
      onClick={() => setExpanded((v) => !v)}
    >
      {/* ── Row 1: icon + title + badge + kill ─────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px 4px' }}>
        <span style={{ fontSize: '13px', flexShrink: 0, color: 'var(--frost)' }}>{icon}</span>
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
          {job.title.length > 60 ? job.title.slice(0, 57) + '…' : job.title}
        </span>
        <JobStatusBadge status={job.status} />

        {/* Kill / confirm kill */}
        {isKillable && !confirmKill && (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmKill(true); }}
            disabled={killing}
            style={{
              background: 'none',
              border: '1px solid #ef4444',
              borderRadius: '3px',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: '10px',
              padding: '2px 6px',
              flexShrink: 0,
            }}
            title="Kill this session"
          >
            ✕
          </button>
        )}
        {isKillable && confirmKill && !killing && (
          <div
            style={{ display: 'flex', gap: '4px', flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleConfirmKill}
              style={{
                background: '#ef4444',
                border: 'none',
                borderRadius: '3px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '9px',
                fontWeight: 600,
                padding: '2px 6px',
              }}
            >
              Kill?
            </button>
            <button
              onClick={() => setConfirmKill(false)}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: '3px',
                color: 'var(--mist)',
                cursor: 'pointer',
                fontSize: '9px',
                padding: '2px 5px',
              }}
            >
              ×
            </button>
          </div>
        )}
        {killing && (
          <span style={{ fontSize: '10px', color: 'var(--mist)', flexShrink: 0 }}>killing…</span>
        )}

        <span
          style={{
            color: 'var(--mist)',
            fontSize: '10px',
            flexShrink: 0,
            transform: expanded ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s',
          }}
        >
          ▾
        </span>
      </div>

      {/* ── Row 2: metrics ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          padding: '2px 12px 6px',
          fontSize: '10px',
          color: 'var(--mist)',
        }}
      >
        <span><span style={{ color: 'var(--frost)' }}>type </span>{job.taskType}</span>
        <span><span style={{ color: 'var(--frost)' }}>steps </span>{job.stepsCompleted}</span>
        {job.filesModified.length > 0 && (
          <span><span style={{ color: 'var(--frost)' }}>files </span>{job.filesModified.length}</span>
        )}
        {isActive && <span><span style={{ color: 'var(--frost)' }}>elapsed </span>{elapsed}</span>}
      </div>

      {/* ── Row 3: cost ticker + cap bar ───────────────────────────────── */}
      {(isActive || isCompleted) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0 12px 6px',
            fontSize: '10px',
            color: 'var(--mist)',
          }}
        >
          <span>
            <span style={{ color: 'var(--frost)' }}>$</span>
            {(isActive ? job.costSoFar : job.costUsd).toFixed(4)}
          </span>
          {softCapUsd > 0 && isActive && (
            <>
              <span
                style={{
                  fontFamily: 'monospace',
                  color: capPct >= 80 ? '#f59e0b' : capPct >= 100 ? '#ef4444' : 'var(--mist)',
                  letterSpacing: '-1px',
                }}
              >
                {capBar}
              </span>
              <span style={{ color: capPct >= 80 ? '#f59e0b' : 'var(--mist)' }}>
                {capPct}% of ${softCapUsd.toFixed(2)}
              </span>
            </>
          )}
          {(isCompleted || job.status === 'failed') && (
            <span style={{ color: 'var(--mist)' }}>
              · {job.tokensUsed.toLocaleString()} tok
            </span>
          )}
        </div>
      )}

      {killError && (
        <div style={{ padding: '2px 12px 4px', fontSize: '10px', color: '#ef4444' }}>
          {killError}
        </div>
      )}

      {/* ── Row 4: action buttons (completed state) ────────────────────── */}
      {(isCompleted || job.status === 'failed') && (
        <div
          style={{ display: 'flex', gap: '6px', padding: '2px 12px 8px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: '3px',
              color: 'var(--frost)',
              cursor: 'pointer',
              fontSize: '10px',
              padding: '3px 8px',
            }}
          >
            {expanded ? 'Hide Output ▲' : 'View Output ▼'}
          </button>
          {/* S9-11: Edit & Retry for failed jobs */}
          {job.status === 'failed' && onEditRetry && (
            <button
              onClick={() => onEditRetry(job)}
              style={{
                background: 'none',
                border: '1px solid var(--accent)',
                borderRadius: '3px',
                color: 'var(--accent)',
                cursor: 'pointer',
                fontSize: '10px',
                padding: '3px 8px',
              }}
            >
              ✏ Edit &amp; Retry
            </button>
          )}
          {/* [Merge PR] — Sprint 7H: functional, CI-gated */}
          {isSelfEvolutionComplete && !merged && (
            <button
              onClick={mergeReady ? handleMergePR : undefined}
              disabled={!mergeReady || merging}
              title={
                mergeReady
                  ? `Merge PR #${job.prNumber ?? ''} (squash)`
                  : mergeCIFailed
                  ? 'CI failed — cannot merge'
                  : mergeAwaitingCI
                  ? `PR #${job.prNumber} — awaiting CI…`
                  : 'Awaiting PR creation…'
              }
              style={{
                background: mergeReady ? 'var(--accent)' : 'none',
                border: `1px solid ${
                  mergeCIFailed ? 'var(--error)' :
                  mergeReady    ? 'var(--accent)' :
                  'var(--border)'
                }`,
                borderRadius: '3px',
                color: mergeReady
                  ? '#fff'
                  : mergeCIFailed
                  ? 'var(--error)'
                  : 'var(--mist)',
                cursor: mergeReady && !merging ? 'pointer' : 'not-allowed',
                fontSize: '10px',
                padding: '3px 8px',
                opacity: (!mergeReady && !mergeCIFailed) ? 0.5 : 1,
              }}
            >
              {merging
                ? 'Merging…'
                : mergeCIFailed
                ? 'CI Failed'
                : mergeAwaitingCI
                ? `PR #${job.prNumber} ⏳`
                : mergeReady
                ? `Merge PR #${job.prNumber} ↑`
                : 'Awaiting PR…'}
            </button>
          )}
          {isSelfEvolutionComplete && merged && (
            <span
              style={{
                fontSize: '10px',
                color: 'var(--success)',
                padding: '3px 8px',
              }}
            >
              ✓ Merged
            </span>
          )}
          {mergeError && (
            <span style={{ fontSize: '10px', color: 'var(--error)' }}>
              {mergeError}
            </span>
          )}
        </div>
      )}

      {/* ── Live output panel (expanded) ───────────────────────────────── */}
      {expanded && (
        <div onClick={(e) => e.stopPropagation()}>
          <LiveOutputPanel manifestId={job.manifestId} isActive={isActive} />
        </div>
      )}
    </div>
  );
}
