'use client';

/**
 * MemoryTab — Sprint 27.0
 *
 * Inspector tab for Ambient Memory (Recall) diagnostics.
 * Shows: detection stats, action breakdown, last 10 events, manual trigger.
 *
 * Data sources:
 *   GET /api/recall/history  — events + aggregate stats
 *   POST /api/recall/run     — manual detection pass
 */

import { useEffect, useState, useCallback } from 'react';
import type { RecallEvent } from '@/lib/recall/types';
import type { ImportSource } from '@/lib/import/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RecallStats {
  total: number;
  surfaced: number;
  appreciated: number;
  dismissed: number;
  snoozed: number;
}

interface HistoryResponse {
  events: RecallEvent[];
  stats: RecallStats;
}

interface RunResult {
  detected: number;
  eligible: number;
  stored: number;
  events: Array<{
    id: string;
    type: string;
    source_name: string;
    message: string;
    relevance_score: number;
    eligible: boolean;
  }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, string> = {
  file_revisit:           '📄',
  conversation_callback:  '💬',
  project_milestone:      '🏁',
  personal_moment:        '✨',
  work_anniversary:       '🎂',
  pattern_insight:        '🔮',
};

const ACTION_LABELS: Record<string, string> = {
  appreciated: 'Thanks',
  dismissed:   'Not now',
  snoozed:     'Snoozed',
};

function relTime(epochMs: number): string {
  const diff = Date.now() - epochMs;
  const m = Math.floor(diff / 60_000);
  if (m < 2)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Shared style fragments ────────────────────────────────────────────────────

const SECTION_HEADER: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: 'var(--mist)',
  marginBottom: 8,
  marginTop: 16,
};

const STAT_CARD: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--shadow)',
  borderRadius: 6,
  padding: '8px 10px',
  textAlign: 'center' as const,
  flex: 1,
};

// ── Component ─────────────────────────────────────────────────────────────────

export function MemoryTab() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importSources, setImportSources] = useState<ImportSource[]>([]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/recall/history');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json() as HistoryResponse;
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    fetch('/api/import/sources')
      .then((r) => r.ok ? r.json() as Promise<ImportSource[]> : Promise.resolve([]))
      .then((sources) => setImportSources(sources))
      .catch(() => { /* non-critical */ });
  }, []);

  const handleRun = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch('/api/recall/run', { method: 'POST' });
      const body = await res.json() as RunResult;
      setRunResult(body);
      // Refresh history after run
      await fetchHistory();
    } catch {
      // Non-critical
    } finally {
      setRunning(false);
    }
  }, [running, fetchHistory]);

  if (loading) {
    return (
      <div style={{ color: 'var(--mist)', fontSize: 13, padding: '8px 0' }}>
        Loading recall history…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          color: '#f87171',
          fontSize: 12,
          padding: '8px 10px',
          background: 'rgba(248,113,113,0.08)',
          borderRadius: 6,
          border: '1px solid rgba(248,113,113,0.2)',
        }}
      >
        Error: {error}
        <button
          onClick={() => void fetchHistory()}
          style={{
            marginLeft: 8,
            color: 'var(--cyan)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const stats = data?.stats;
  const events = (data?.events ?? []).slice(0, 10);
  const dismissalRate =
    stats && stats.surfaced > 0
      ? Math.round((stats.dismissed / stats.surfaced) * 100)
      : null;

  return (
    <div style={{ fontSize: 13 }}>

      {/* Manual trigger */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--frost)' }}>Run detection pass</span>
        <button
          onClick={() => void handleRun()}
          disabled={running}
          style={{
            padding: '5px 12px',
            borderRadius: 6,
            border: '1px solid rgba(255,191,36,0.3)',
            background: running ? 'var(--surface)' : 'rgba(255,191,36,0.08)',
            color: running ? 'var(--mist)' : 'rgba(255,191,36,0.9)',
            cursor: running ? 'wait' : 'pointer',
            fontSize: 12,
            fontWeight: 600,
            transition: 'all 0.15s ease',
          }}
        >
          {running ? 'Running…' : '▶ Run now'}
        </button>
      </div>

      {/* Run result summary */}
      {runResult && (
        <div
          style={{
            padding: '6px 10px',
            background: 'rgba(255,191,36,0.06)',
            border: '1px solid rgba(255,191,36,0.2)',
            borderRadius: 6,
            fontSize: 11,
            color: 'rgba(255,191,36,0.8)',
            marginBottom: 8,
          }}
        >
          Detected {runResult.detected} · Eligible {runResult.eligible} · Stored {runResult.stored}
        </div>
      )}

      {/* Aggregate stats */}
      <div style={SECTION_HEADER}>Aggregate</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
        <div style={STAT_CARD}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ice-white)' }}>
            {stats?.total ?? 0}
          </div>
          <div style={{ fontSize: 10, color: 'var(--mist)', marginTop: 2 }}>Total</div>
        </div>
        <div style={STAT_CARD}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ice-white)' }}>
            {stats?.surfaced ?? 0}
          </div>
          <div style={{ fontSize: 10, color: 'var(--mist)', marginTop: 2 }}>Surfaced</div>
        </div>
        <div style={STAT_CARD}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: dismissalRate !== null && dismissalRate > 60 ? '#f87171' : 'var(--ice-white)',
            }}
          >
            {dismissalRate !== null ? `${dismissalRate}%` : '—'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--mist)', marginTop: 2 }}>Dismiss rate</div>
        </div>
      </div>

      {/* Action breakdown */}
      <div style={SECTION_HEADER}>Actions</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
        {(['appreciated', 'dismissed', 'snoozed'] as const).map((action) => {
          const count = stats?.[action] ?? 0;
          const colors: Record<string, string> = {
            appreciated: 'rgba(255,191,36,0.8)',
            dismissed:   'var(--mist)',
            snoozed:     'var(--frost)',
          };
          return (
            <div key={action} style={{ ...STAT_CARD, borderColor: `${colors[action]}22` }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: colors[action] }}>
                {count}
              </div>
              <div style={{ fontSize: 10, color: 'var(--mist)', marginTop: 2 }}>
                {ACTION_LABELS[action]}
              </div>
            </div>
          );
        })}
      </div>

      {/* Last 10 events */}
      <div style={SECTION_HEADER}>Recent ({events.length})</div>
      {events.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--mist)', fontStyle: 'italic' }}>
          No recall events yet. Run a detection pass to populate.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {events.map((ev) => (
            <div
              key={ev.id}
              style={{
                padding: '8px 10px',
                background: 'var(--surface)',
                borderRadius: 6,
                border: ev.user_action
                  ? '1px solid var(--shadow)'
                  : '1px solid rgba(255,191,36,0.15)',
                opacity: ev.user_action ? 0.65 : 1,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 12 }}>
                  {TYPE_ICON[ev.type] ?? '💡'}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'rgba(255,191,36,0.5)',
                  }}
                >
                  {ev.source_name}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--mist)' }}>
                  {relTime(ev.created_at)}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--frost)', lineHeight: 1.4 }}>
                {ev.message.slice(0, 120)}{ev.message.length > 120 ? '…' : ''}
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 5,
                  fontSize: 10,
                  color: 'var(--mist)',
                }}
              >
                <span>score: {Math.round(ev.relevance_score * 100) / 100}</span>
                {ev.user_action && (
                  <span style={{ color: 'rgba(255,191,36,0.5)' }}>
                    {ACTION_LABELS[ev.user_action] ?? ev.user_action}
                  </span>
                )}
                {ev.surfaced_at && !ev.user_action && (
                  <span style={{ color: 'rgba(255,191,36,0.6)' }}>● surfaced</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Import Sources (EPIC-81) ─────────────────────────────────── */}
      <div style={{ ...SECTION_HEADER, marginTop: 20 }}>Import Sources</div>
      {importSources.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--mist)', fontStyle: 'italic' }}>
          No imported sources yet.{' '}
          <span style={{ color: 'var(--frost)', cursor: 'pointer' }}>
            Drop files in Settings → Import to get started.
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {importSources.map((src) => (
            <div
              key={src.id}
              style={{
                padding: '6px 10px',
                background: 'var(--surface)',
                borderRadius: 6,
                border: '1px solid var(--shadow)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--frost)' }}>
                  {src.display_name}
                </span>
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 10,
                    color: 'var(--mist)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {src.source_type}
                </span>
              </div>
              <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--mist)' }}>
                <div>{src.conversation_count} conv · {src.chunk_count} chunks</div>
                {src.last_synced_at && (
                  <div>{relTime(src.last_synced_at)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
