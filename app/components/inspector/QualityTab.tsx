/**
 * QualityTab — S9-14
 * Full code quality issue list (not just top 5) + quality sparkline.
 */

'use client';

import { useState } from 'react';
import { useContextPanel } from '@/lib/context/context-provider';
import { EoSIssueRow } from '@/components/context/EoSIssueRow';
import { EoSSparkLine } from '@/components/context/EoSSparkLine';
import type { EoSIssueSummary } from '@/lib/context/types';

export function QualityTab() {
  const { state } = useContextPanel();
  const eos = state.eosSummary;
  const projectId = state.activeProject?.id ?? '';
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);

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