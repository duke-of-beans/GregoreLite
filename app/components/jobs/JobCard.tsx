'use client';
/**
 * JobCard
 *
 * Single job in the queue. Shows title, status badge, task type icon,
 * step count, live cost ticker, kill button, and expandable log tail.
 *
 * BLUEPRINT §4.3 (Job Queue UI layout)
 */


import { useState } from 'react';
import { useJobStore } from '@/lib/stores/job-store';
import type { JobRecord, JobState } from '@/lib/agent-sdk/types';

// ─── Status badge config ──────────────────────────────────────────────────────

const STATE_CONFIG: Record<JobState, { label: string; color: string; pulse: boolean }> = {
  SPAWNING:   { label: 'spawning',   color: 'var(--mist)',    pulse: true  },
  RUNNING:    { label: 'running',    color: 'var(--accent)',  pulse: true  },
  WORKING:    { label: 'working',    color: 'var(--success)', pulse: true  },
  VALIDATING: { label: 'validating', color: 'var(--warning)', pulse: true  },
  COMPLETED:  { label: 'completed',  color: 'var(--success)', pulse: false },
  FAILED:     { label: 'failed',     color: 'var(--error)',   pulse: false },
  INTERRUPTED:{ label: 'stopped',    color: 'var(--mist)',    pulse: false },
};

// ─── Task type icons (text glyphs — no icon lib dependency) ──────────────────

const TASK_ICONS: Record<string, string> = {
  code:           '⚙',
  test:           '✓',
  docs:           '✎',
  research:       '⌕',
  deploy:         '⬆',
  self_evolution: '⟳',
};

const KILLABLE: JobState[] = ['SPAWNING', 'RUNNING', 'WORKING', 'VALIDATING'];

interface JobCardProps {
  job: JobRecord;
}

export function JobCard({ job }: JobCardProps) {
  const { killJob } = useJobStore();
  const [expanded, setExpanded] = useState(false);
  const [killing, setKilling] = useState(false);

  const cfg = STATE_CONFIG[job.state];
  const icon = TASK_ICONS[job.manifest.task.type] ?? '·';
  const canKill = KILLABLE.includes(job.state);

  async function handleKill(e: React.MouseEvent) {
    e.stopPropagation();
    if (!canKill || killing) return;
    setKilling(true);
    try {
      await killJob(job.jobId);
    } finally {
      setKilling(false);
    }
  }

  const logTail = job.logLines.slice(-10);

  return (
    <div
      className="job-card"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        marginBottom: '8px',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
      onClick={() => setExpanded((v) => !v)}
    >
      {/* ── Header row ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px' }}>

        {/* Task type icon */}
        <span style={{ fontSize: '14px', flexShrink: 0, color: 'var(--frost)' }}>{icon}</span>

        {/* Title */}
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
          title={job.manifest.task.title}
        >
          {job.manifest.task.title}
        </span>

        {/* Status badge */}
        <span
          style={{
            fontSize: '10px',
            color: cfg.color,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: cfg.color,
              animation: cfg.pulse ? 'pulse 1.5s ease-in-out infinite' : 'none',
              display: 'inline-block',
            }}
          />
          {cfg.label}
        </span>

        {/* Kill button */}
        {canKill && (
          <button
            onClick={handleKill}
            disabled={killing}
            style={{
              background: 'none',
              border: '1px solid var(--error)',
              borderRadius: '3px',
              color: 'var(--error)',
              cursor: killing ? 'not-allowed' : 'pointer',
              fontSize: '10px',
              padding: '2px 6px',
              flexShrink: 0,
              opacity: killing ? 0.5 : 1,
            }}
            title="Kill this session"
          >
            {killing ? '…' : '✕'}
          </button>
        )}

        {/* Expand chevron */}
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

      {/* ── Metrics row ──────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          padding: '0 12px 8px',
          fontSize: '10px',
          color: 'var(--mist)',
        }}
      >
        <span>
          <span style={{ color: 'var(--frost)' }}>steps </span>
          {job.currentStep}/{job.totalSteps}
        </span>
        <span>
          <span style={{ color: 'var(--frost)' }}>cost </span>
          ${job.costUsd.toFixed(4)}
        </span>
        <span>
          <span style={{ color: 'var(--frost)' }}>tokens </span>
          {job.tokensUsed.toLocaleString()}
        </span>
      </div>

      {/* ── Log tail (expanded) ───────────────────────────────────────── */}
      {expanded && logTail.length > 0 && (
        <div
          style={{
            borderTop: '1px solid var(--border)',
            padding: '8px 12px',
            background: 'var(--bg)',
            maxHeight: '160px',
            overflowY: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {logTail.map((line, i) => (
            <div
              key={i}
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '10px',
                color: 'var(--mist)',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {line}
            </div>
          ))}
        </div>
      )}

      {expanded && logTail.length === 0 && (
        <div
          style={{
            borderTop: '1px solid var(--border)',
            padding: '8px 12px',
            fontSize: '10px',
            color: 'var(--mist)',
            fontStyle: 'italic',
          }}
        >
          No output yet…
        </div>
      )}
    </div>
  );
}
