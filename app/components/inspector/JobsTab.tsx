import { apiFetch } from '@/lib/api-client';
/**
 * JobsTab — S9-14 / Sprint 19.0
 * Selected job detail: full manifest JSON, events, cost breakdown.
 * Sprint 19.0: Action History section with per-entry undo (Law 3).
 */

'use client';

import { useState, useEffect } from 'react';
import { useJobStore } from '@/lib/stores/job-store';
import type { ActionJournalEntry } from '@/lib/agent-sdk/action-journal';

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
  const [actions, setActions] = useState<ActionJournalEntry[]>([]);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [undoMessage, setUndoMessage] = useState<string | null>(null);

  // Auto-select latest job
  useEffect(() => {
    const first = jobs[0];
    if (first && !selectedId) {
      setSelectedId(first.jobId);
    }
  }, [jobs, selectedId]);

  // Fetch detail and action history when selection changes
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
    void (async () => {
      try {
        const res = await fetch(`/api/agent-sdk/actions?sessionId=${encodeURIComponent(selectedId)}`);
        if (res.ok) {
          const body = await res.json() as { data: ActionJournalEntry[] };
          setActions(body.data);
        }
      } catch { /* silent */ }
    })();
  }, [selectedId]);

  const handleUndo = (entryId: string) => {
    setUndoingId(entryId);
    setUndoMessage(null);
    void (async () => {
      try {
        const res = await apiFetch('/api/agent-sdk/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entryId, action: 'undo' }),
        });
        const body = await res.json() as { data?: { message: string }; error?: string };
        if (res.ok && body.data) {
          setUndoMessage(body.data.message);
          // Refresh action list
          if (selectedId) {
            const r2 = await fetch(`/api/agent-sdk/actions?sessionId=${encodeURIComponent(selectedId)}`);
            if (r2.ok) {
              const b2 = await r2.json() as { data: ActionJournalEntry[] };
              setActions(b2.data);
            }
          }
        } else {
          setUndoMessage(body.error ?? 'Undo failed.');
        }
      } catch (err) {
        setUndoMessage(err instanceof Error ? err.message : 'Undo failed.');
      } finally {
        setUndoingId(null);
      }
    })();
  };

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
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--shadow)', background: 'var(--elevated)', color: 'var(--cyan)', cursor: 'pointer', fontSize: 11, textAlign: 'left' }}
          >
            {showManifest ? '▼' : '▶'} Manifest JSON
          </button>
          {showManifest && detail.manifest && (
            <pre style={{ padding: 10, background: 'var(--surface)', borderRadius: 6, fontSize: 10, color: 'var(--frost)', overflow: 'auto', maxHeight: 300, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {JSON.stringify(detail.manifest, null, 2)}
            </pre>
          )}

          {/* Action History — Sprint 19.0 (Law 3: Reversibility) */}
          <h4 style={{ fontSize: 11, fontWeight: 600, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '8px 0 4px' }}>
            Action History
          </h4>
          {undoMessage && (
            <div style={{ fontSize: 11, color: 'var(--success)', padding: '4px 8px', background: 'var(--surface)', borderRadius: 4 }}>
              {undoMessage}
            </div>
          )}
          {actions.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--frost)', padding: 4 }}>No actions recorded.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {actions.map((entry) => {
                const label = entry.target_path
                  ? entry.target_path.split(/[\\/]/).pop() ?? entry.target_path
                  : entry.command?.slice(0, 40) ?? entry.tool_name;
                const ts = new Date(entry.created_at).toLocaleTimeString();
                return (
                  <div key={entry.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', background: 'var(--surface)', borderRadius: 5, gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 11, color: entry.undone ? 'var(--frost)' : 'var(--ice-white)', textDecoration: entry.undone ? 'line-through' : 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {label}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--frost)' }}>{entry.tool_name} · {ts}</span>
                    </div>
                    {entry.reversible && !entry.undone ? (
                      <button
                        onClick={() => handleUndo(entry.id)}
                        disabled={undoingId === entry.id}
                        title="Undo this action"
                        style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--shadow)', background: 'var(--elevated)', color: 'var(--cyan)', cursor: 'pointer', fontSize: 10, flexShrink: 0 }}
                      >
                        {undoingId === entry.id ? '…' : '↩ Undo'}
                      </button>
                    ) : (
                      <span
                        title={entry.undone ? 'Already undone' : 'This action cannot be undone'}
                        style={{ fontSize: 10, color: 'var(--frost)', flexShrink: 0 }}
                      >
                        {entry.undone ? 'undone' : 'irreversible'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
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