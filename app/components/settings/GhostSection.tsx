'use client';
import { apiFetch } from '@/lib/api-client';
/**
 * GhostSection — Sprint 20.0
 * Ghost Thread status + control panel in Settings.
 *
 * Shows:
 *  • Master toggle (start / stop Ghost Thread)
 *  • Live status from Zustand ghost-store (Active / Partial / Paused / Off)
 *  • Watched paths list (from /api/ghost/watch-paths)
 *  • Email connector status (Gmail / Outlook) from GhostStatus
 *  • Privacy Exclusions link → Privacy Dashboard modal
 */


import { useEffect, useState, useCallback } from 'react';
import { useGhostStore } from '@/lib/stores/ghost-store';

const ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const LABEL: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--frost)',
};

const VALUE: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--ice-white)',
};

const CHIP: React.CSSProperties = {
  padding: '4px 10px',
  background: 'var(--surface)',
  borderRadius: 4,
  fontSize: 13,
  color: 'var(--ice-white)',
};

const DIVIDER: React.CSSProperties = {
  height: 1,
  background: 'var(--shadow)',
  margin: '8px 0',
};

function statusColor(state: string | undefined): string {
  if (!state || state === 'stopped' || state === 'error') return 'var(--mist)';
  if (state === 'running') return '#4ade80'; // green-400
  return '#fbbf24'; // amber-400
}

function statusLabel(state: string | undefined): string {
  if (!state || state === 'stopped' || state === 'error') return 'Off';
  if (state === 'running') return 'Active';
  if (state === 'degraded') return 'Partial';
  if (state === 'paused') return 'Paused';
  if (state === 'starting') return 'Starting…';
  return 'Off';
}

export function GhostSection() {
  const ghostStatus = useGhostStore((s) => s.ghostStatus);
  const [watchPaths, setWatchPaths] = useState<string[]>([]);
  const [toggling, setToggling] = useState(false);

  // Fetch watch paths on mount
  const fetchPaths = useCallback(async () => {
    try {
      const res = await apiFetch('/api/ghost/watch-paths');
      if (res.ok) {
        const body = await res.json();
        setWatchPaths(body.paths ?? []);
      }
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchPaths();
  }, [fetchPaths]);

  const isRunning =
    ghostStatus?.state === 'running' ||
    ghostStatus?.state === 'degraded' ||
    ghostStatus?.state === 'starting';

  const handleToggle = async () => {
    if (toggling) return;
    setToggling(true);
    try {
      const route = isRunning ? '/api/ghost/stop' : '/api/ghost/start';
      await fetch(route, { method: 'POST' });
    } catch {
      // Degraded is fine — lifecycle handles it
    } finally {
      setToggling(false);
    }
  };

  const handleManageExclusions = () => {
    import('@/lib/stores/ui-store')
      .then((m) => {
        m.useUIStore.getState().openModal('privacy-dashboard');
      })
      .catch(() => {/* silent */});
  };

  const emailGmail = ghostStatus?.emailConnectors?.gmail ?? false;
  const emailOutlook = ghostStatus?.emailConnectors?.outlook ?? false;

  return (
    <div style={{ marginBottom: 24 }}>
      <h3
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--ice-white)',
          marginBottom: 12,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Ghost
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Status + Toggle */}
        <div style={ROW}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: statusColor(ghostStatus?.state),
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <span style={{ ...VALUE, fontWeight: 600 }}>
              {statusLabel(ghostStatus?.state)}
            </span>
          </div>
          <button
            onClick={handleToggle}
            disabled={toggling || ghostStatus?.state === 'starting'}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid var(--shadow)',
              background: isRunning ? 'var(--elevated)' : 'var(--cyan)',
              color: isRunning ? 'var(--frost)' : 'var(--deep-space)',
              cursor: toggling ? 'wait' : 'pointer',
              fontSize: 12,
              fontWeight: 600,
              opacity: toggling ? 0.6 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            {toggling ? '…' : isRunning ? 'Stop Ghost' : 'Start Ghost'}
          </button>
        </div>

        {/* Errors (degraded only) */}
        {ghostStatus?.state === 'degraded' && ghostStatus.errors.length > 0 && (
          <div
            style={{
              padding: '8px 10px',
              background: 'rgba(251,191,36,0.08)',
              border: '1px solid rgba(251,191,36,0.2)',
              borderRadius: 6,
              fontSize: 12,
              color: '#fbbf24',
            }}
          >
            Partial: {ghostStatus.errors.map((e) => e.component).join(', ')} unavailable —
            email + scorer still active.
          </div>
        )}

        <div style={DIVIDER} />

        {/* Watch Paths */}
        <div>
          <span style={{ ...LABEL, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--mist)' }}>
            Watched Folders
          </span>
          {watchPaths.length === 0 ? (
            <div style={{ ...VALUE, fontSize: 12, marginTop: 6, color: 'var(--mist)', fontStyle: 'italic' }}>
              No paths configured
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
              {watchPaths.map((p) => (
                <div
                  key={p}
                  style={{
                    padding: '4px 8px',
                    background: 'var(--surface)',
                    borderRadius: 4,
                    fontSize: 12,
                    color: 'var(--frost)',
                    fontFamily: 'monospace',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={DIVIDER} />

        {/* Email Connectors */}
        <div>
          <span style={{ ...LABEL, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--mist)' }}>
            Email
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            <div style={ROW}>
              <span style={LABEL}>Gmail</span>
              <span
                style={{
                  ...CHIP,
                  color: emailGmail ? '#4ade80' : 'var(--mist)',
                }}
              >
                {emailGmail ? 'Connected' : 'Not connected'}
              </span>
            </div>
            <div style={ROW}>
              <span style={LABEL}>Outlook</span>
              <span
                style={{
                  ...CHIP,
                  color: emailOutlook ? '#4ade80' : 'var(--mist)',
                }}
              >
                {emailOutlook ? 'Connected' : 'Not connected'}
              </span>
            </div>
          </div>
        </div>

        <div style={DIVIDER} />

        {/* Privacy Exclusions */}
        <div style={ROW}>
          <span style={LABEL}>Privacy Exclusions</span>
          <button
            onClick={handleManageExclusions}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--shadow)',
              background: 'var(--elevated)',
              color: 'var(--cyan)',
              cursor: 'pointer',
              fontSize: 12,
              transition: 'all 0.15s ease',
            }}
          >
            Manage Exclusions →
          </button>
        </div>
      </div>
    </div>
  );
}
