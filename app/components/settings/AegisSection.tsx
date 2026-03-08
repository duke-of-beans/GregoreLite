'use client';
/**
 * AegisSection (System Monitor) — Sprint 16.0
 * Always-connected system monitor status + profile selector.
 * Embedded via Tauri IPC.
 * Dev mode: shows "Dev Mode" badge; profile selector disabled.
 */


import { useState, useEffect } from 'react';
import { getStatus, switchProfile, isTauriAvailable } from '@/lib/aegis/client';
import type { AegisStatus, ProfileSummary } from '@/lib/aegis/types';

export function AegisSection() {
  const [status, setStatus] = useState<AegisStatus | null>(null);
  const [tauriAvailable, setTauriAvailable] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const available = await isTauriAvailable();
      if (cancelled) return;
      setTauriAvailable(available);

      const s = await getStatus();
      if (!cancelled) setStatus(s);
    }

    void load();

    // Poll every 3s for live metrics
    const interval = setInterval(() => { void load(); }, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  async function handleSwitch(profileName: string) {
    if (switching) return;
    setSwitching(true);
    await switchProfile(profileName);
    // Refresh status after switch
    const s = await getStatus();
    setStatus(s);
    setSwitching(false);
  }

  const activeColor = status?.active_profile_color ?? '#888';

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ice-white)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        System Monitor
      </h3>
      <p style={{ fontSize: 11, color: 'var(--frost)', opacity: 0.7, marginBottom: 12 }}>Resource monitoring and workload management</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Connection status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--frost)' }}>Status</span>
          <span style={{
            fontSize: 12,
            color: tauriAvailable ? 'var(--success)' : 'var(--frost)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: tauriAvailable ? 'var(--success)' : '#666',
              display: 'inline-block',
            }} />
            {tauriAvailable ? 'Connected' : 'Dev Mode'}
          </span>
        </div>

        {/* Active profile */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--frost)' }}>Active Profile</span>
          <span style={{
            fontSize: 13,
            color: activeColor,
            fontWeight: 600,
            padding: '4px 10px',
            background: 'var(--surface)',
            borderRadius: 4,
            borderLeft: `3px solid ${activeColor}`,
          }}>
            {status?.active_profile_display ?? '—'}
          </span>
        </div>

        {/* Metrics */}
        {status?.metrics && status.metrics.cpu_percent > 0 && (
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--frost)' }}>CPU</span>
              <span style={{ fontSize: 12, color: 'var(--ice-white)', fontFamily: 'monospace' }}>
                {status.metrics.cpu_percent}%
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--frost)' }}>MEM</span>
              <span style={{ fontSize: 12, color: 'var(--ice-white)', fontFamily: 'monospace' }}>
                {status.metrics.memory_percent}%
              </span>
            </div>
          </div>
        )}

        {/* Profile selector */}
        {status?.profiles && status.profiles.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--frost)', marginBottom: 6, display: 'block' }}>
              Switch Profile
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {status.profiles.map((p: ProfileSummary) => (
                <button
                  key={p.name}
                  onClick={() => void handleSwitch(p.name)}
                  disabled={switching || p.is_active || !tauriAvailable}
                  title={p.description}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: p.is_active
                      ? `1px solid ${p.color}`
                      : '1px solid var(--shadow)',
                    background: p.is_active ? `${p.color}20` : 'var(--elevated)',
                    color: p.is_active ? p.color : 'var(--frost)',
                    cursor: (switching || p.is_active || !tauriAvailable) ? 'default' : 'pointer',
                    fontSize: 12,
                    opacity: (switching || !tauriAvailable) && !p.is_active ? 0.5 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {p.display_name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
