'use client';
import { apiFetch } from '@/lib/api-client';
/**
 * InsightReviewPanel — Transit Map Learning Engine UI
 * Sprint 11.7
 *
 * Shown in the Inspector drawer as the "Learning" tab (6th tab).
 * Lists proposed/applied/dismissed insights grouped by status.
 * Confidence bars color-coded: red <50, amber 50–70, green 70+.
 */


import { useState, useEffect, useCallback } from 'react';
import type { LearningInsight } from '@/lib/transit/learning/types';

// ── Types ────────────────────────────────────────────────────────────────────

type ActionType = 'approve' | 'dismiss' | 'rollback' | 'run_pipeline';

interface ApiResponse {
  insights?: LearningInsight[];
  success?: boolean;
  pipelineResults?: unknown;
  error?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function confidenceColor(c: number): string {
  if (c >= 70) return 'var(--green-400)';
  if (c >= 50) return 'var(--amber-400)';
  return 'var(--red-400)';
}

function statusLabel(s: LearningInsight['status']): string {
  const map: Record<LearningInsight['status'], string> = {
    proposed: 'Proposed',
    approved: 'Approved',
    applied: 'Applied',
    dismissed: 'Dismissed',
    rolled_back: 'Rolled Back',
    expired: 'Expired',
  };
  return map[s] ?? s;
}

function patternColor(p: string): string {
  if (p === 'verbosity') return 'var(--amber-400)';
  if (p === 'regeneration') return 'var(--red-400)';
  if (p === 'model_routing') return 'var(--cyan)';
  return 'var(--frost)';
}

// ── InsightCard ───────────────────────────────────────────────────────────────

interface InsightCardProps {
  insight: LearningInsight;
  onAction: (id: string, action: ActionType) => void;
  actioning: boolean;
}

function InsightCard({ insight, onAction, actioning }: InsightCardProps) {
  const [expanded, setExpanded] = useState(false);
  const adj = insight.adjustment;
  const faded = insight.status === 'expired' || insight.status === 'dismissed';

  return (
    <div style={{
      background: 'var(--glass-subtle)',
      border: '1px solid var(--shadow)',
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      opacity: faded ? 0.5 : 1,
      transition: 'opacity 0.15s ease',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 8 }}>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          padding: '2px 6px',
          borderRadius: 4,
          background: patternColor(insight.pattern_type),
          color: 'var(--deep-space)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          flexShrink: 0,
          marginTop: 1,
        }}>
          {insight.pattern_type.replace('_', ' ')}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ice-white)', flex: 1, lineHeight: 1.4 }}>
          {insight.title}
        </span>
        <span style={{
          fontSize: 10,
          color: 'var(--frost)',
          flexShrink: 0,
          padding: '2px 6px',
          background: 'var(--glass-overlay)',
          borderRadius: 4,
          marginTop: 1,
        }}>
          {statusLabel(insight.status)}
        </span>
      </div>

      {/* Confidence bar */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--frost)' }}>Confidence</span>
          <span style={{ fontSize: 10, color: confidenceColor(insight.confidence), fontWeight: 700 }}>
            {insight.confidence}%
          </span>
        </div>
        <div style={{ height: 3, background: 'var(--glass-dim)', borderRadius: 2 }}>
          <div style={{
            height: '100%',
            width: `${insight.confidence}%`,
            background: confidenceColor(insight.confidence),
            borderRadius: 2,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Sample + adjustment */}
      <div style={{ fontSize: 11, color: 'var(--frost)', marginBottom: 8 }}>
        <strong style={{ color: 'var(--ice-white)' }}>{insight.sample_size}</strong> events analyzed
      </div>
      <div style={{
        fontSize: 10,
        color: 'var(--frost)',
        background: 'var(--backdrop-light)',
        borderRadius: 4,
        padding: '4px 8px',
        marginBottom: 8,
        fontFamily: 'monospace',
        lineHeight: 1.5,
      }}>
        <span style={{ color: 'var(--amber-400)' }}>{adj.type}</span>
        {' on '}
        <span style={{ color: 'var(--cyan)' }}>{adj.target}</span>
        <br />
        <span style={{ color: 'var(--frost)' }}>{String(adj.current_value)}</span>
        {' → '}
        <span style={{ color: 'var(--green-400)', fontWeight: 600 }}>{String(adj.proposed_value)}</span>
      </div>

      {/* Expandable description */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          background: 'none', border: 'none', color: 'var(--frost)',
          cursor: 'pointer', fontSize: 10, padding: 0,
          marginBottom: expanded ? 6 : 0, display: 'flex', alignItems: 'center', gap: 3,
        }}
      >
        {expanded ? '▾' : '▸'} {expanded ? 'Hide' : 'Details'}
      </button>
      {expanded && (
        <p style={{ fontSize: 11, color: 'var(--frost)', margin: '0 0 8px', lineHeight: 1.6 }}>
          {insight.description}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        {(insight.status === 'proposed' || insight.status === 'approved') && (
          <>
            <button
              disabled={actioning}
              onClick={() => onAction(insight.id, 'approve')}
              aria-label={`Approve insight: ${insight.title}`}
              style={{
                padding: '4px 12px', background: 'var(--green-400)',
                color: 'var(--deep-space)', border: 'none', borderRadius: 4,
                fontSize: 11, fontWeight: 700,
                cursor: actioning ? 'not-allowed' : 'pointer', opacity: actioning ? 0.6 : 1,
              }}
            >Approve</button>
            <button
              disabled={actioning}
              onClick={() => onAction(insight.id, 'dismiss')}
              aria-label={`Dismiss insight: ${insight.title}`}
              style={{
                padding: '4px 12px', background: 'var(--glass-muted)',
                color: 'var(--frost)', border: '1px solid var(--shadow)', borderRadius: 4,
                fontSize: 11, cursor: actioning ? 'not-allowed' : 'pointer', opacity: actioning ? 0.6 : 1,
                transition: 'background 0.15s ease, border-color 0.15s ease',
              }}
            >Dismiss</button>
          </>
        )}
        {insight.status === 'applied' && (
          <button
            disabled={actioning}
            onClick={() => onAction(insight.id, 'rollback')}
            aria-label={`Rollback insight: ${insight.title}`}
            style={{
              padding: '4px 12px', background: 'var(--amber-400)',
              color: 'var(--deep-space)', border: 'none', borderRadius: 4,
              fontSize: 11, fontWeight: 700,
              cursor: actioning ? 'not-allowed' : 'pointer', opacity: actioning ? 0.6 : 1,
            }}
          >↩ Rollback</button>
        )}
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES: LearningInsight['status'][] = ['proposed', 'approved', 'applied'];
const ARCHIVE_STATUSES: LearningInsight['status'][] = ['dismissed', 'rolled_back', 'expired'];

export function InsightReviewPanel() {
  const [insights, setInsights] = useState<LearningInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [lastRun, setLastRun] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/transit/insights');
      const data = (await res.json()) as ApiResponse;
      if (data.insights) setInsights(data.insights);
      setError(null);
    } catch {
      setError('Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchInsights(); }, [fetchInsights]);

  const handleAction = useCallback(async (insightId: string, action: ActionType) => {
    setActioning(true);
    try {
      const res = await apiFetch('/api/transit/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, insightId }),
      });
      const data = (await res.json()) as ApiResponse;
      if (data.error) setError(data.error);
      else { setError(null); await fetchInsights(); }
    } catch {
      setError('Action failed');
    } finally {
      setActioning(false);
    }
  }, [fetchInsights]);

  const handleRunPipeline = useCallback(async () => {
    setPipelineRunning(true);
    try {
      const res = await apiFetch('/api/transit/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_pipeline' }),
      });
      const data = (await res.json()) as ApiResponse;
      if (data.error) setError(data.error);
      else { setError(null); setLastRun(Date.now()); await fetchInsights(); }
    } catch {
      setError('Pipeline run failed');
    } finally {
      setPipelineRunning(false);
    }
  }, [fetchInsights]);

  const active = insights.filter((i) => ACTIVE_STATUSES.includes(i.status));
  const archive = insights.filter((i) => ARCHIVE_STATUSES.includes(i.status));

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ice-white)' }}>
            Learning Insights
          </div>
          {lastRun && (
            <div style={{ fontSize: 10, color: 'var(--frost)', marginTop: 2 }}>
              Last run: {new Date(lastRun).toLocaleTimeString()}
            </div>
          )}
        </div>
        <button
          disabled={pipelineRunning}
          onClick={() => void handleRunPipeline()}
          style={{
            padding: '4px 12px',
            background: pipelineRunning ? 'var(--glass-muted)' : 'var(--cyan)',
            color: pipelineRunning ? 'var(--frost)' : 'var(--deep-space)',
            border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700,
            cursor: pipelineRunning ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {pipelineRunning ? '⟳ Running…' : '▶ Run Pipeline'}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          background: 'var(--status-error-bg)', border: '1px solid var(--red-400)',
          borderRadius: 6, padding: '7px 10px', fontSize: 11,
          color: 'var(--red-400)', marginBottom: 12,
        }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ fontSize: 11, color: 'var(--frost)', textAlign: 'center', padding: '20px 0' }}>
          Loading…
        </div>
      )}

      {/* Empty state */}
      {!loading && active.length === 0 && archive.length === 0 && (
        <div style={{
          fontSize: 11, color: 'var(--frost)', textAlign: 'center',
          padding: '28px 16px', lineHeight: 1.7,
        }}>
          No insights yet.<br />
          Run the pipeline to analyse conversation patterns.
        </div>
      )}

      {/* Active insights */}
      {active.map((insight) => (
        <InsightCard
          key={insight.id}
          insight={insight}
          onAction={(id, action) => void handleAction(id, action)}
          actioning={actioning}
        />
      ))}

      {/* Archive */}
      {archive.length > 0 && (
        <>
          <div style={{
            fontSize: 10, color: 'var(--frost)', textTransform: 'uppercase',
            letterSpacing: 1, fontWeight: 700, marginTop: 16, marginBottom: 8,
          }}>
            Archive ({archive.length})
          </div>
          {archive.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onAction={(id, action) => void handleAction(id, action)}
              actioning={actioning}
            />
          ))}
        </>
      )}
    </div>
  );
}
