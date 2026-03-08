'use client';
import { apiFetch } from '@/lib/api-client';

/**
 * EoSIssueRow
 *
 * Renders a single EoS health issue in the Quality section of ContextPanel.
 * The dismiss (×) button fires POST /api/eos/fp — marking the rule as a
 * false positive for this project. Auto-suppression in fp-tracker handles
 * the rest when the FP rate exceeds 20%.
 */

import { useState } from 'react';
import type { EoSIssueSummary } from '@/lib/context/types';

interface EoSIssueRowProps {
  issue: EoSIssueSummary;
  projectId: string;
  /** Called after successful dismiss so parent can optimistically remove the row */
  onDismissed?: (ruleId: string, file: string) => void;
}

/** Trim a file path to the last two segments for compact display */
function shortPath(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts.slice(-2).join('/');
}

const SEVERITY_DOT: Record<EoSIssueSummary['severity'], string> = {
  critical: 'bg-[var(--error)]',
  warning: 'bg-[var(--warning)]',
  info: 'bg-[var(--mist)]',
};

export function EoSIssueRow({ issue, projectId, onDismissed }: EoSIssueRowProps) {
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (dismissed) return null;

  const handleDismiss = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await apiFetch('/api/eos/fp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ruleId: issue.ruleId,
          action: 'dismissed',
          filePath: issue.file,
          projectId,
          ...(issue.line !== undefined && { line: issue.line }),
        }),
      });
      if (res.ok) {
        setDismissed(true);
        onDismissed?.(issue.ruleId, issue.file);
      }
    } catch {
      // Dismiss failed silently — don't crash the panel
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-start gap-2 px-4 py-1 group">
      {/* Severity dot */}
      <span
        className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${SEVERITY_DOT[issue.severity]}`}
        title={issue.severity}
      />

      {/* Issue text */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] text-[var(--frost)] leading-snug">{issue.message}</p>
        <p className="truncate text-[10px] text-[var(--mist)]">
          {shortPath(issue.file)}
          {issue.line !== undefined && <span className="ml-1 opacity-60">:{issue.line}</span>}
        </p>
      </div>

      {/* Dismiss button */}
      <button
        onClick={() => void handleDismiss()}
        disabled={loading}
        className="flex-shrink-0 text-[var(--mist)] opacity-0 group-hover:opacity-100 hover:text-[var(--ice-white)] transition-opacity disabled:cursor-not-allowed text-[13px] leading-none mt-0.5"
        title="Mark as false positive"
        aria-label={`Dismiss: ${issue.message}`}
      >
        ×
      </button>
    </div>
  );
}
