'use client';
/**
 * QualityTab — S9-14
 * Full code quality issue list (not just top 5) + quality sparkline.
 * Sprint 22.0: Added Attention Budget section (moved from StatusBar).
 */


import { useState, useEffect } from 'react';
import { useContextPanel } from '@/lib/context/context-provider';
import { EoSIssueRow } from '@/components/context/EoSIssueRow';
import { EoSSparkLine } from '@/components/context/EoSSparkLine';
import {
  getAttentionRemaining,
  getAttentionHistory,
  isBudgetExhausted,
  DAILY_BUDGET,
  ATTENTION_COSTS,
} from '@/lib/focus/attention-budget';
import type { EoSIssueSummary } from '@/lib/context/types';

export function QualityTab() {
  const { state } = useContextPanel();
  const eos = state.eosSummary;
  const projectId = state.activeProject?.id ?? '';
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);

  // Sprint 22.0 — Attention Budget (moved from StatusBar)
  const [attnRemaining, setAttnRemaining] = useState(() => getAttentionRemaining());
  const [attnExhausted, setAttnExhausted] = useState(() => isBudgetExhausted());

  useEffect(() => {
    const refresh = () => {
      setAttnRemaining(getAttentionRemaining());
      setAttnExhausted(isBudgetExhausted());
    };
    const handle = setInterval(refresh, 10_000);
    return () => clearInterval(handle);
  }, []);

  const attnHistory = getAttentionHistory();
  const attnSpendByType = Object.entries(ATTENTION_COSTS).map(([type, cost]) => {
    const count = attnHistory.filter((s) => s.type === type).length;
    return { type, cost, count, total: count * cost };
  }).filter((s) => s.count > 0);

  const handleDismissed = (ruleId: string, file: string) => {
    setDismissedKeys((prev) => new Set(prev).add(`${ruleId}:${file}`));
  };

  const visibleIssues: EoSIssueSummary[] = (eos?.issues ?? [])
    .filter((i) => !dismissedKeys.has(`${i.ruleId}:${i.file}`));

  const criticalCount = visibleIssues.filter((i) => i.severity === 'critical').length;
  const warningCount = visibleIssues.filter((i) => i.severity === 'warning').length;
  const infoCount = visibleIssues.filter((i) => i.severity === 'info').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Attention Budget (Sprint 22.0 — moved from StatusBar) ── */}
      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
        Attention Budget
      </h3>
      <div style={{ padding: '10px 12px', background: 'var(--surface)', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Budget bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--frost)' }}>Remaining today</span>
          <span style={{
            fontSize: 14,
            fontWeight: 700,
            fontFamily: 'monospace',
            color: attnExhausted ? 'var(--error, #f87171)' : attnRemaining > 50 ? 'var(--ice-white)' : 'var(--warning, #fbbf24)',
          }}>
            {attnRemaining}/{DAILY_BUDGET} CT
          </span>
        </div>
        <div style={{ height: 4, background: 'var(--shadow)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${(attnRemaining / DAILY_BUDGET) * 100}%`,
            background: attnExhausted ? 'var(--error, #f87171)' : attnRemaining > 50 ? 'var(--cyan)' : 'var(--warning, #fbbf24)',
            borderRadius: 2,
            transition: 'width 0.3s ease',
          }} />
        </div>
        {/* Spend breakdown */}
        {attnSpendByType.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--mist)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Spend this session</span>
            {attnSpendByType.map(({ type, cost, count, total }) => (
              <div key={type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--frost)' }}>
                <span style={{ textTransform: 'capitalize' }}>{type.replace(/_/g, ' ')} ×{count} ({cost} CT ea)</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--ice-white)' }}>−{total} CT</span>
              </div>
            ))}
          </div>
        )}
        {attnSpendByType.length === 0 && (
          <span style={{ fontSize: 11, color: 'var(--mist)', fontStyle: 'italic' }}>No interrupts fired this session.</span>
        )}
        <span style={{ fontSize: 10, color: 'var(--mist)', marginTop: 2 }}>Resets at midnight. Only critical alerts fire when exhausted.</span>
      </div>

      {/* ── Code Quality ── */}
      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
        Code Quality
      </h3>

      {/* Score + Sparkline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--surface)', borderRadius: 6 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--ice-white)' }}>
          {eos?.healthScore ?? '—'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--frost)' }}>{eos?.grade ?? 'unknown'}</div>
        {projectId && eos && (
          <div style={{ marginLeft: 'auto' }}>
            <EoSSparkLine
              projectId={projectId}
              currentScore={eos.healthScore}
              onOpenHistory={() => setShowHistory(!showHistory)}
            />
          </div>
        )}
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
        <span style={{ color: 'var(--error)' }}>{criticalCount} critical</span>
        <span style={{ color: 'var(--warning)' }}>{warningCount} warning</span>
        <span style={{ color: 'var(--frost)' }}>{infoCount} info</span>
      </div>

      {eos?.lastScannedAt && (
        <div style={{ fontSize: 11, color: 'var(--frost)', opacity: 0.7 }}>
          Last scan: {new Date(eos.lastScannedAt).toLocaleString()}
        </div>
      )}

      {/* Full issue list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 400, overflowY: 'auto' }}>
        {visibleIssues.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--frost)', padding: 8 }}>Clean bill of health. No issues detected.</div>
        ) : (
          visibleIssues.map((issue) => (
            <EoSIssueRow
              key={`${issue.ruleId}:${issue.file}`}
              issue={issue}
              projectId={projectId}
              onDismissed={handleDismissed}
            />
          ))
        )}
      </div>
    </div>
  );
}