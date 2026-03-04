/**
 * CostBreakdown — Sprint S9-10
 *
 * Modal panel showing cost breakdown by project.
 * Three tabs: Today, This Week, All Time.
 * Table: project, sessions, input tokens, output tokens, cost USD.
 * Total row at bottom.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

type RangeTab = 'today' | 'week' | 'all';

interface CostRow {
  project_id: string | null;
  session_count: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
}

interface CostTotals {
  session_count: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
}

interface CostBreakdownProps {
  onClose: () => void;
}

const TABS: { id: RangeTab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'all', label: 'All Time' },
];

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function CostBreakdown({ onClose }: CostBreakdownProps) {
  const [range, setRange] = useState<RangeTab>('today');
  const [rows, setRows] = useState<CostRow[]>([]);
  const [totals, setTotals] = useState<CostTotals | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (r: RangeTab) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/costs/breakdown?range=${r}`);
      if (res.ok) {
        const body = await res.json();
        setRows(body.data?.rows ?? []);
        setTotals(body.data?.totals ?? null);
      }
    } catch {
      // Non-critical
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchData(range);
  }, [range, fetchData]);

  // Handle Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '560px',
          maxHeight: '80vh',
          background: 'var(--elevated, #1a1f2e)',
          borderRadius: '8px',
          border: '1px solid var(--shadow, #2a3040)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--shadow, #2a3040)',
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ice-white, #e5e7eb)' }}>
            Cost Breakdown by Project
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--mist, #888)',
              fontSize: '16px',
            }}
            aria-label="Close cost breakdown"
          >
            ✕
          </button>
        </div>

        {/* Tab bar */}
        <div
          style={{
            display: 'flex',
            gap: '0',
            borderBottom: '1px solid var(--shadow, #2a3040)',
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setRange(tab.id)}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: range === tab.id ? 'var(--deep-space, #0d1117)' : 'transparent',
                border: 'none',
                borderBottom: range === tab.id ? '2px solid var(--cyan, #22d3ee)' : '2px solid transparent',
                color: range === tab.id ? 'var(--ice-white, #e5e7eb)' : 'var(--mist, #888)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loading && (
            <p style={{ padding: '16px', color: 'var(--mist, #888)', fontSize: '12px' }}>
              Loading…
            </p>
          )}

          {!loading && rows.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <p style={{ color: 'var(--mist, #888)', fontSize: '13px', fontStyle: 'italic' }}>
                No cost data for this period
              </p>
            </div>
          )}

          {!loading && rows.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ color: 'var(--mist, #888)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 16px', fontWeight: 500 }}>Project</th>
                  <th style={{ padding: '6px 8px', fontWeight: 500, textAlign: 'right' }}>Sessions</th>
                  <th style={{ padding: '6px 8px', fontWeight: 500, textAlign: 'right' }}>Input</th>
                  <th style={{ padding: '6px 8px', fontWeight: 500, textAlign: 'right' }}>Output</th>
                  <th style={{ padding: '6px 16px', fontWeight: 500, textAlign: 'right' }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      color: 'var(--frost, #9ca3af)',
                      borderBottom: '1px solid var(--shadow, #2a304020)',
                    }}
                  >
                    <td style={{ padding: '6px 16px', fontWeight: 500, color: 'var(--ice-white, #e5e7eb)' }}>
                      {row.project_id ?? '(unassigned)'}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {row.session_count}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatTokens(row.input_tokens)}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatTokens(row.output_tokens)}
                    </td>
                    <td style={{ padding: '6px 16px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--ice-white, #e5e7eb)' }}>
                      ${row.total_cost_usd.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Total row */}
              {totals && (
                <tfoot>
                  <tr
                    style={{
                      borderTop: '1px solid var(--shadow, #2a3040)',
                      color: 'var(--ice-white, #e5e7eb)',
                      fontWeight: 600,
                    }}
                  >
                    <td style={{ padding: '8px 16px' }}>Total</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {totals.session_count}
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatTokens(totals.input_tokens)}
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatTokens(totals.output_tokens)}
                    </td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--cyan, #22d3ee)' }}>
                      ${totals.total_cost_usd.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
      {/* Sprint 12.0: Prompt caching + Batch API status notice */}
      <div
        style={{
          padding: '8px 16px',
          borderTop: '1px solid var(--shadow, #2a3040)',
          fontSize: '11px',
          color: 'var(--muted, #6b7280)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span style={{ color: 'var(--cyan, #22d3ee)' }}>⚡</span>
        <span>
          Prompt caching active — repeated context reads at 90% discount.
          Batch API jobs run on Haiku for an additional 50% savings.
        </span>
      </div>
    </div>
  );
}
