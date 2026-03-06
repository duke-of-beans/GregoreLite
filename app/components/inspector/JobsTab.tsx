/**
 * JobsTab — S9-14
 * Selected job detail: full manifest JSON, events, cost breakdown.
 */

'use client';

import { useState, useEffect } from 'react';
import { useJobStore } from '@/lib/stores/job-store';

interface JobDetail {
  id: string;
  status: string;
  taskType: string;
  title: string;
  description: string | null;
  projectPath: string | null;
  model: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  tokensUsedSoFar: number;
  estimatedCostUsd: number;
  logPath: string | null;
  events: Array<{ type: string; timestamp: string; message?: string }>;
  manifest?: Record<string, unknown>;
}

export function JobsTab() {
  const jobs = useJobStore((s) => s.jobs);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [showManifest, setShowManifest] = useState(false);

  // Auto-select latest job
  useEffect(() => {
    const first = jobs[0];
    if (first && !selectedId) {
      setSelectedId(first.jobId);
    }
  }, [jobs, selectedId]);

  // Fetch detail when selection changes
  useEffect(() => {
    if (!selectedId) return;
    void (async () => {
      try {
        const res = await fetch(`/api/agent-sdk/jobs/${selectedId}`);
        if (res.ok) {
          const body = await res.json() as { data: JobDetail };
          setDetail(body.data);
        }
      } catch { /* silent */ }
    })();
  }, [selectedId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
        Jobs Inspector
      </h3>

      {/* Job selector */}
      {jobs.length > 0 && (
        <select
          value={selectedId ?? ''}
          onChange={(e) => { setSelectedId(e.target.value); setDetail(null); setShowManifest(false); }}
          style={{
            padding: '6px 8px',
            borderRadius: 6,
            border: '1px solid var(--shadow)',
            background: 'var(--elevated)',
            color: 'var(--ice-white)',
            fontSize: 12,
          }}
        >
          {jobs.map((j) => (
            <option key={j.jobId} value={j.jobId}>
              {j.manifest.task.title} ({j.state})
            </option>
          ))}
        </select>
      )}

      {detail ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface)', borderRadius: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--frost)' }}>Status</span>
            <span style={{ fontSize: 12, color: detail.status === 'completed' ? 'var(--success)' : detail.status === 'failed' ? 'var(--error)' : 'var(--cyan)', fontWeight: 600 }}>{detail.status}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface)', borderRadius: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--frost)' }}>Model</span>
            <span style={{ fontSize: 12, color: 'var(--ice-white)' }}>{detail.model}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface)', borderRadius: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--frost)' }}>Tokens</span>
            <span style={{ fontSize: 12, color: 'var(--ice-white)', fontWeight: 600 }}>{detail.tokensUsedSoFar.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface)', borderRadius: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--frost)' }}>Cost</span>
            <span style={{ fontSize: 12, color: 'var(--ice-white)', fontWeight: 600 }}>${detail.estimatedCostUsd.toFixed(4)}</span>
          </div>

          {/* Manifest toggle */}
          <button
            onClick={() => setShowManifest(!showManifest)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--shadow)',
              background: 'var(--elevated)',
              color: 'var(--cyan)',
              cursor: 'pointer',
              fontSize: 11,
              textAlign: 'left',
            }}
          >
            {showManifest ? '▼' : '▶'} Manifest JSON
          </button>
          {showManifest && detail.manifest && (
            <pre style={{
              padding: 10,
              background: 'var(--surface)',
              borderRadius: 6,
              fontSize: 10,
              color: 'var(--frost)',
              overflow: 'auto',
              maxHeight: 300,
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
              {JSON.stringify(detail.manifest, null, 2)}
            </pre>
          )}
        </div>
      ) : jobs.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--frost)', padding: 8 }}>Nothing running. The workers are on break.</div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--frost)', padding: 8 }}>Loading…</div>
      )}
    </div>
  );
}