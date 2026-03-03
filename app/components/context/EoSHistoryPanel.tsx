/**
 * EoSHistoryPanel — Sprint S9-09
 *
 * Full history drawer showing last 50 EoS scans.
 * Table: date, score, delta, critical count, warning count, scan mode.
 * Click a row to expand and see the full issues_json for that scan.
 */

'use client';

import { useState, useEffect } from 'react';

interface EoSReport {
  id: string;
  project_id: string;
  health_score: number;
  issues_json: string;
  files_scanned: number;
  duration_ms: number;
  scan_mode: string;
  created_at: string;
}

interface ParsedIssue {
  ruleId: string;
  severity: string;
  message: string;
  file: string;
  line?: number;
}

interface EoSHistoryPanelProps {
  projectId: string;
  onClose: () => void;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'var(--success, #22c55e)';
  if (score >= 60) return 'var(--warning, #f59e0b)';
  return 'var(--error, #ef4444)';
}

export function EoSHistoryPanel({ projectId, onClose }: EoSHistoryPanelProps) {
  const [reports, setReports] = useState<EoSReport[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/eos/history?projectId=${encodeURIComponent(projectId)}&limit=50`)
      .then((res) => res.json())
      .then((body) => {
        setReports((body.data as EoSReport[]) ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId]);

  const parseIssues = (json: string): ParsedIssue[] => {
    try {
      return JSON.parse(json) as ParsedIssue[];
    } catch {
      return [];
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '420px',
        background: 'var(--elevated, #1a1f2e)',
        borderLeft: '1px solid var(--shadow, #2a3040)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.3)',
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
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ice-white, #e5e7eb)' }}>
          EoS Scan History
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
          aria-label="Close history panel"
        >
          ✕
        </button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {loading && (
          <p style={{ padding: '16px', color: 'var(--mist, #888)', fontSize: '12px' }}>
            Loading…
          </p>
        )}

        {!loading && reports.length === 0 && (
          <p style={{ padding: '16px', color: 'var(--mist, #888)', fontSize: '12px', fontStyle: 'italic' }}>
            No scan history available
          </p>
        )}

        {reports.map((report, idx) => {
          const nextReport = reports[idx + 1]; // DESC order: idx+1 is older
          const delta = nextReport
            ? Math.round(report.health_score - nextReport.health_score)
            : 0;
          const deltaStr = delta > 0 ? `+${delta}` : delta === 0 ? '—' : `${delta}`;
          const issues = parseIssues(report.issues_json);
          const criticalCount = issues.filter((i) => i.severity === 'critical').length;
          const warningCount = issues.filter((i) => i.severity === 'warning').length;
          const expanded = expandedId === report.id;

          return (
            <div key={report.id}>
              <button
                onClick={() => setExpandedId(expanded ? null : report.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 50px 40px 40px 40px 50px',
                  gap: '4px',
                  width: '100%',
                  padding: '6px 16px',
                  background: expanded ? 'var(--deep-space, #0d1117)' : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--shadow, #2a304020)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: 'var(--frost, #9ca3af)',
                  fontSize: '11px',
                }}
                aria-expanded={expanded}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {new Date(report.created_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span style={{ color: scoreColor(report.health_score), fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(report.health_score)}
                </span>
                <span style={{
                  fontVariantNumeric: 'tabular-nums',
                  color: delta > 0 ? 'var(--success, #22c55e)' : delta < 0 ? 'var(--error, #ef4444)' : 'var(--mist, #888)',
                }}>
                  {deltaStr}
                </span>
                <span style={{ color: criticalCount > 0 ? 'var(--error, #ef4444)' : 'var(--mist, #888)' }}>
                  {criticalCount}C
                </span>
                <span style={{ color: warningCount > 0 ? 'var(--warning, #f59e0b)' : 'var(--mist, #888)' }}>
                  {warningCount}W
                </span>
                <span style={{ color: 'var(--ghost-text, #4a5568)' }}>
                  {report.scan_mode}
                </span>
              </button>

              {/* Expanded issues */}
              {expanded && (
                <div
                  style={{
                    padding: '8px 16px 12px',
                    background: 'var(--deep-space, #0d1117)',
                    borderBottom: '1px solid var(--shadow, #2a3040)',
                  }}
                >
                  <div style={{ fontSize: '10px', color: 'var(--mist, #888)', marginBottom: '6px' }}>
                    {report.files_scanned} files scanned in {report.duration_ms}ms
                  </div>
                  {issues.length === 0 ? (
                    <p style={{ fontSize: '11px', color: 'var(--success, #22c55e)' }}>
                      ✓ No issues
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {issues.map((issue, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: '10px',
                            color: issue.severity === 'critical'
                              ? 'var(--error, #ef4444)'
                              : issue.severity === 'warning'
                                ? 'var(--warning, #f59e0b)'
                                : 'var(--frost, #9ca3af)',
                            lineHeight: 1.4,
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>[{issue.ruleId}]</span>{' '}
                          {issue.file}
                          {issue.line ? `:${issue.line}` : ''} — {issue.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
