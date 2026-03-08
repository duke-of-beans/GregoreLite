import { apiFetch } from '@/lib/api-client';
/**
 * WebSessionSection — Sprint 32.0
 *
 * Controls message routing mode: API Only / Web Session / Auto.
 * Displays session status, connect/disconnect, governor stats,
 * and advanced governor limit overrides.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { WEB_SESSION } from '@/lib/voice/copy-templates';
import type { ChatMode, GovernorStats } from '@/lib/web-session/types';
import { DEFAULT_GOVERNOR_LIMITS } from '@/lib/web-session/types';

interface SessionStatus {
  connected: boolean;
  expiresIn?: string;
  status: 'active' | 'expired' | 'disconnected';
  governor: GovernorStats;
}

const MODES: { value: ChatMode; label: string; desc: string }[] = [
  { value: 'api',         label: WEB_SESSION.mode_api,  desc: WEB_SESSION.mode_api_desc },
  { value: 'web_session', label: WEB_SESSION.mode_web,  desc: WEB_SESSION.mode_web_desc },
  { value: 'auto',        label: WEB_SESSION.mode_auto, desc: WEB_SESSION.mode_auto_desc },
];

const GOVERNOR_FIELDS: { key: string; label: string; unit: string; defaultVal: number }[] = [
  { key: 'web_governor_max_per_minute', label: 'Max / minute', unit: 'msg',  defaultVal: DEFAULT_GOVERNOR_LIMITS.maxPerMinute },
  { key: 'web_governor_max_per_hour',   label: 'Max / hour',   unit: 'msg',  defaultVal: DEFAULT_GOVERNOR_LIMITS.maxPerHour },
  { key: 'web_governor_max_per_day',    label: 'Max / day',    unit: 'msg',  defaultVal: DEFAULT_GOVERNOR_LIMITS.maxPerDay },
  { key: 'web_governor_min_delay_ms',   label: 'Min delay',    unit: 'ms',   defaultVal: DEFAULT_GOVERNOR_LIMITS.minDelayMs },
];

export function WebSessionSection() {
  const [chatMode, setChatMode]           = useState<ChatMode>('api');
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [govValues, setGovValues]         = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced]   = useState(false);
  const [connecting, setConnecting]       = useState(false);
  const [savingGov, setSavingGov]         = useState(false);

  // ── Load current mode + governor limits from /api/settings ────────────────
  const loadSettings = useCallback(async () => {
    try {
      const res = await apiFetch('/api/settings');
      if (res.ok) {
        const body = await res.json() as { data: Record<string, string> };
        const mode = (body.data.web_session_mode as ChatMode) ?? 'api';
        setChatMode(mode);
        const gov: Record<string, string> = {};
        for (const f of GOVERNOR_FIELDS) {
          gov[f.key] = body.data[f.key] ?? String(f.defaultVal);
        }
        setGovValues(gov);
      }
    } catch { /* silent */ }
  }, []);

  // ── Load session status from /api/web-session/status ──────────────────────
  const loadStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/web-session/status');
      if (res.ok) {
        const body = await res.json() as { data: SessionStatus };
        setSessionStatus(body.data);
      }
    } catch { /* endpoint not yet wired — silent */ }
  }, []);

  useEffect(() => {
    void loadSettings();
    void loadStatus();
  }, [loadSettings, loadStatus]);

  // ── Mode selector ─────────────────────────────────────────────────────────
  async function handleModeChange(mode: ChatMode) {
    setChatMode(mode);
    try {
      await apiFetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ web_session_mode: mode }),
      });
    } catch { /* silent */ }
  }

  // ── Connect / Disconnect ──────────────────────────────────────────────────
  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await apiFetch('/api/web-session/connect', { method: 'POST' });
      if (res.ok) await loadStatus();
    } catch { /* silent */ } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    try {
      await apiFetch('/api/web-session/disconnect', { method: 'POST' });
      await loadStatus();
    } catch { /* silent */ }
  }

  // ── Governor field save ───────────────────────────────────────────────────
  async function handleGovSave(key: string, value: string) {
    setSavingGov(true);
    try {
      await apiFetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
    } catch { /* silent */ } finally {
      setSavingGov(false);
    }
  }

  // ── Derived display ───────────────────────────────────────────────────────
  const statusLabel = (() => {
    if (!sessionStatus) return WEB_SESSION.status_disconnected;
    if (sessionStatus.status === 'active' && sessionStatus.expiresIn) {
      return WEB_SESSION.status_active(sessionStatus.expiresIn);
    }
    if (sessionStatus.status === 'expired') return WEB_SESSION.status_expired;
    return WEB_SESSION.status_disconnected;
  })();

  const maxPerDay = parseInt(govValues['web_governor_max_per_day'] ?? String(DEFAULT_GOVERNOR_LIMITS.maxPerDay), 10);
  const todayCount = sessionStatus?.governor.today ?? 0;
  const progressPct = Math.min(100, (todayCount / maxPerDay) * 100);

  // ── Styles (match existing settings sections) ─────────────────────────────
  const s = {
    section:      { marginBottom: 32 } as React.CSSProperties,
    heading:      { fontSize: 14, fontWeight: 600, color: 'var(--ice-white)', marginBottom: 12, textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
    description:  { fontSize: 12, color: 'var(--frost)', marginBottom: 16, lineHeight: 1.5 },
    row:          { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 } as React.CSSProperties,
    label:        { fontSize: 13, color: 'var(--frost)' },
    sublabel:     { fontSize: 11, color: 'var(--frost)', opacity: 0.7, marginTop: 2 },
    radioGroup:   { display: 'flex', flexDirection: 'column' as const, gap: 8 },
    radioItem:    (active: boolean) => ({
      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
      borderRadius: 6, cursor: 'pointer',
      background: active ? 'rgba(99,179,237,0.08)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${active ? 'rgba(99,179,237,0.3)' : 'rgba(255,255,255,0.07)'}`,
    } as React.CSSProperties),
    radioLabel:   (active: boolean) => ({ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? 'var(--ice-white)' : 'var(--frost)' }),
    radioDesc:    { fontSize: 11, color: 'var(--frost)', opacity: 0.75, marginTop: 2 },
    statusDot:    (ok: boolean) => ({ width: 6, height: 6, borderRadius: '50%', background: ok ? 'var(--success)' : 'rgba(255,255,255,0.25)', flexShrink: 0, marginTop: 4 }),
    button:       { fontSize: 12, padding: '5px 12px', borderRadius: 5, border: '1px solid rgba(99,179,237,0.3)', background: 'rgba(99,179,237,0.1)', color: 'var(--ice-white)', cursor: 'pointer' } as React.CSSProperties,
    buttonDanger: { fontSize: 12, padding: '5px 12px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', cursor: 'pointer' } as React.CSSProperties,
    progressBar:  { height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' as const, marginTop: 8 },
    progressFill: (pct: number) => ({ height: '100%', width: `${pct}%`, background: pct > 80 ? '#f59e0b' : 'var(--info)', transition: 'width 0.3s ease' }),
    divider:      { height: 1, background: 'rgba(255,255,255,0.06)', margin: '16px 0' },
    advancedToggle: { fontSize: 12, color: 'var(--frost)', cursor: 'pointer', userSelect: 'none' as const, opacity: 0.75 },
    input:        { fontSize: 12, padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'var(--ice-white)', width: 80 } as React.CSSProperties,
    warning:      { fontSize: 11, color: '#f59e0b', lineHeight: 1.4, padding: '8px 10px', borderRadius: 4, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' },
  };

  return (
    <div style={s.section}>
      <h3 style={s.heading}>{WEB_SESSION.settings_title}</h3>
      <p style={s.description}>{WEB_SESSION.settings_description}</p>

      {/* ── Mode selector ── */}
      <div style={s.radioGroup}>
        {MODES.map(({ value, label, desc }) => (
          <div
            key={value}
            style={s.radioItem(chatMode === value)}
            onClick={() => void handleModeChange(value)}
          >
            <div style={{ marginTop: 2 }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%', border: '2px solid',
                borderColor: chatMode === value ? 'var(--info)' : 'rgba(255,255,255,0.25)',
                background: chatMode === value ? 'var(--info)' : 'transparent',
                flexShrink: 0,
              }} />
            </div>
            <div>
              <div style={s.radioLabel(chatMode === value)}>{label}</div>
              <div style={s.radioDesc}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Session status + connect/disconnect (shown when mode ≠ api) ── */}
      {chatMode !== 'api' && (
        <>
          <div style={s.divider} />

          <div style={s.row}>
            <div>
              <div style={s.label}>Session Status</div>
              <div style={s.sublabel}>{statusLabel}</div>
            </div>
            {sessionStatus?.status === 'active' ? (
              <button style={s.buttonDanger} onClick={() => void handleDisconnect()}>
                {WEB_SESSION.disconnect_button}
              </button>
            ) : (
              <button style={s.button} disabled={connecting} onClick={() => void handleConnect()}>
                {connecting ? 'Connecting…' : WEB_SESSION.connect_button}
              </button>
            )}
          </div>

          {/* ── Governor stats ── */}
          <div style={{ marginTop: 12 }}>
            <div style={{ ...s.row, marginBottom: 4 }}>
              <span style={s.label}>{WEB_SESSION.governor_title}</span>
              <span style={{ fontSize: 12, color: 'var(--frost)' }}>
                {WEB_SESSION.governor_stats(todayCount, maxPerDay)}
              </span>
            </div>
            <div style={s.progressBar}>
              <div style={s.progressFill(progressPct)} />
            </div>
          </div>

          {/* ── Advanced governor limits ── */}
          <div style={{ marginTop: 16 }}>
            <span style={s.advancedToggle} onClick={() => setShowAdvanced((v) => !v)}>
              {showAdvanced ? '▾' : '▸'} {WEB_SESSION.governor_title} — Advanced
            </span>
            {showAdvanced && (
              <div style={{ marginTop: 12 }}>
                <p style={{ ...s.warning, marginBottom: 12 }}>{WEB_SESSION.governor_warning}</p>
                {GOVERNOR_FIELDS.map(({ key, label, unit, defaultVal }) => (
                  <div key={key} style={{ ...s.row, marginBottom: 10 }}>
                    <div>
                      <div style={s.label}>{label}</div>
                      <div style={s.sublabel}>Default: {defaultVal} {unit}</div>
                    </div>
                    <input
                      style={s.input}
                      type="number"
                      min={1}
                      value={govValues[key] ?? String(defaultVal)}
                      onChange={(e) => setGovValues((prev) => ({ ...prev, [key]: e.target.value }))}
                      onBlur={(e) => void handleGovSave(key, e.target.value)}
                      disabled={savingGov}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
