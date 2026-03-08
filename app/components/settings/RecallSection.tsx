import { apiFetch } from '@/lib/api-client';
'use client';

/**
 * RecallSection — Sprint 27.0
 *
 * Settings section for Ambient Memory (Recall).
 * Persists settings to /api/recall/settings (GET + POST).
 *
 * Controls:
 *   - Master enable/disable toggle
 *   - Max highlights per day (0–5 slider)
 *   - Detection frequency dropdown (1h / 2h / 4h / 8h)
 *   - Per-type toggles (6 recall types)
 */

import { useEffect, useState, useCallback } from 'react';
import type { RecallSchedulerSettings, RecallType } from '@/lib/recall/types';
import { DEFAULT_RECALL_SETTINGS } from '@/lib/recall/types';

// ── Shared sub-styles (matches GhostSection patterns) ─────────────────────────

const ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const LABEL: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--frost)',
};

const DIVIDER: React.CSSProperties = {
  height: 1,
  background: 'var(--shadow)',
  margin: '8px 0',
};

const SUBLABEL: React.CSSProperties = {
  fontSize: 12,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  color: 'var(--mist)',
  marginBottom: 8,
};

// ── Type labels ───────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<RecallType, string> = {
  file_revisit:           'File revisits',
  conversation_callback:  'Conversation callbacks',
  project_milestone:      'Project milestones',
  personal_moment:        'Personal moments',
  work_anniversary:       'Work anniversaries',
  pattern_insight:        'Pattern insights',
};

const ALL_TYPES: RecallType[] = [
  'file_revisit',
  'conversation_callback',
  'project_milestone',
  'personal_moment',
  'work_anniversary',
  'pattern_insight',
];

const FREQ_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Every hour'    },
  { value: 2, label: 'Every 2 hours' },
  { value: 4, label: 'Every 4 hours' },
  { value: 8, label: 'Every 8 hours' },
];

// ── Toggle sub-component ──────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: checked ? 'rgba(255,191,36,0.8)' : 'var(--surface)',
        border: `1px solid ${checked ? 'rgba(255,191,36,0.4)' : 'var(--shadow)'}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
        transition: 'all 0.2s ease',
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: 'var(--ice-white)',
          transition: 'left 0.2s ease',
          display: 'block',
        }}
      />
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function RecallSection() {
  const [settings, setSettings] = useState<RecallSchedulerSettings>(DEFAULT_RECALL_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load settings from server on mount
  useEffect(() => {
    apiFetch('/api/recall/settings')
      .then((r) => (r.ok ? (r.json() as Promise<{ settings: RecallSchedulerSettings }>) : null))
      .then((body) => {
        if (body?.settings) setSettings(body.settings);
      })
      .catch(() => {/* use defaults */});
  }, []);

  const persist = useCallback(async (next: RecallSchedulerSettings) => {
    setSaving(true);
    try {
      await apiFetch('/api/recall/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      // Non-critical
    } finally {
      setSaving(false);
    }
  }, []);

  const update = useCallback((patch: Partial<RecallSchedulerSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    void persist(next);
  }, [settings, persist]);

  const toggleType = useCallback((type: RecallType) => {
    const next = settings.enabledTypes.includes(type)
      ? settings.enabledTypes.filter((t) => t !== type)
      : [...settings.enabledTypes, type];
    update({ enabledTypes: next });
  }, [settings.enabledTypes, update]);

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
        Memory Highlights
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Master enable toggle */}
        <div style={ROW}>
          <div>
            <span style={LABEL}>Enable ambient memory</span>
            <div style={{ fontSize: 11, color: 'var(--mist)', marginTop: 2 }}>
              Surface highlights from your history
            </div>
          </div>
          <Toggle
            checked={settings.enabled}
            onChange={(v) => update({ enabled: v })}
          />
        </div>

        <div style={DIVIDER} />

        {/* Max per day slider */}
        <div style={{ opacity: settings.enabled ? 1 : 0.4, transition: 'opacity 0.2s' }}>
          <div style={ROW}>
            <span style={LABEL}>Max per day</span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'rgba(255,191,36,0.8)',
                minWidth: 16,
                textAlign: 'right',
              }}
            >
              {settings.maxPerDay}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={5}
            step={1}
            value={settings.maxPerDay}
            disabled={!settings.enabled}
            onChange={(e) => update({ maxPerDay: Number(e.target.value) })}
            style={{ width: '100%', marginTop: 6, accentColor: 'rgba(255,191,36,0.8)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--mist)', marginTop: 2 }}>
            <span>Off</span>
            <span>5</span>
          </div>
        </div>

        <div style={DIVIDER} />

        {/* Detection frequency */}
        <div style={{ opacity: settings.enabled ? 1 : 0.4, transition: 'opacity 0.2s' }}>
          <span style={SUBLABEL}>Detection frequency</span>
          <select
            disabled={!settings.enabled}
            value={settings.detectionIntervalHours}
            onChange={(e) => update({ detectionIntervalHours: Number(e.target.value) })}
            style={{
              width: '100%',
              padding: '6px 10px',
              background: 'var(--surface)',
              border: '1px solid var(--shadow)',
              borderRadius: 6,
              color: 'var(--frost)',
              fontSize: 12,
              cursor: settings.enabled ? 'pointer' : 'not-allowed',
            }}
          >
            {FREQ_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div style={DIVIDER} />

        {/* Per-type toggles */}
        <div style={{ opacity: settings.enabled ? 1 : 0.4, transition: 'opacity 0.2s' }}>
          <span style={SUBLABEL}>What to surface</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ALL_TYPES.map((type) => (
              <div key={type} style={ROW}>
                <span style={{ ...LABEL, fontSize: 12 }}>{TYPE_LABELS[type]}</span>
                <Toggle
                  checked={settings.enabledTypes.includes(type)}
                  onChange={() => toggleType(type)}
                  disabled={!settings.enabled}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Save indicator */}
        {(saving || saved) && (
          <div
            style={{
              fontSize: 11,
              color: saved ? 'rgba(255,191,36,0.7)' : 'var(--mist)',
              textAlign: 'right',
              transition: 'color 0.2s',
            }}
          >
            {saving ? 'Saving…' : 'Saved'}
          </div>
        )}
      </div>
    </div>
  );
}
