/**
 * BudgetSettingsPanel — Sprint 7F
 *
 * Lets David configure:
 *   session_soft_cap_usd       — per-session soft cap (warning at 80%, no kill)
 *   daily_hard_cap_usd         — daily total cap (blocks new spawns when reached)
 *   rate_limit_tokens_per_minute — token bucket rate limit
 *
 * Reads current values from GET /api/agent-sdk/budget (to be added in 7G if
 * needed; for now reads via /api/aegis/override which already proxies
 * budget_config). Falls back to built-in defaults.
 *
 * Saves via PATCH /api/agent-sdk/budget — writes to budget_config table.
 */

'use client';

import { useEffect, useState } from 'react';

interface BudgetValues {
  session_soft_cap_usd: number;
  daily_hard_cap_usd: number;
  rate_limit_tokens_per_minute: number;
}

const DEFAULTS: BudgetValues = {
  session_soft_cap_usd: 2.0,
  daily_hard_cap_usd: 15.0,
  rate_limit_tokens_per_minute: 80000,
};

async function loadBudgetConfig(): Promise<BudgetValues> {
  try {
    const res = await fetch('/api/agent-sdk/budget');
    if (!res.ok) return DEFAULTS;
    const json = await res.json() as { data?: Partial<BudgetValues> };
    return { ...DEFAULTS, ...json.data };
  } catch {
    return DEFAULTS;
  }
}

async function saveBudgetConfig(values: BudgetValues): Promise<void> {
  const res = await fetch('/api/agent-sdk/budget', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
  if (!res.ok) {
    const body = await res.json() as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
}

interface BudgetSettingsPanelProps {
  onClose?: () => void;
}

export function BudgetSettingsPanel({ onClose }: BudgetSettingsPanelProps) {
  const [values, setValues] = useState<BudgetValues>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBudgetConfig().then((v) => {
      setValues(v);
      setLoading(false);
    });
  }, []);

  function handleChange(key: keyof BudgetValues, raw: string) {
    const v = parseFloat(raw);
    if (!isNaN(v)) setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await saveBudgetConfig(values);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '16px',
        minWidth: '260px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--frost)', letterSpacing: '0.05em' }}>
          BUDGET SETTINGS
        </span>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--mist)',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '0 2px',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ fontSize: '11px', color: 'var(--mist)', textAlign: 'center', padding: '12px 0' }}>
          Loading…
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Field
            label="Session soft cap (USD)"
            hint="Warning at 80% — session continues"
            value={values.session_soft_cap_usd}
            step={0.5}
            min={0.1}
            onChange={(v) => handleChange('session_soft_cap_usd', v)}
          />
          <Field
            label="Daily hard cap (USD)"
            hint="Blocks new spawns when reached"
            value={values.daily_hard_cap_usd}
            step={1}
            min={1}
            onChange={(v) => handleChange('daily_hard_cap_usd', v)}
          />
          <Field
            label="Rate limit (tokens / min)"
            hint="80% → new spawns queue"
            value={values.rate_limit_tokens_per_minute}
            step={10000}
            min={10000}
            onChange={(v) => handleChange('rate_limit_tokens_per_minute', v)}
          />

          {error && (
            <div style={{ fontSize: '10px', color: '#ef4444' }}>{error}</div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: saved ? '#22c55e' : 'var(--accent)',
              border: 'none',
              borderRadius: '4px',
              color: '#000',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              padding: '7px 14px',
              opacity: saving ? 0.7 : 1,
              marginTop: '4px',
              transition: 'background 0.2s',
            }}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  hint: string;
  value: number;
  step: number;
  min: number;
  onChange: (v: string) => void;
}

function Field({ label, hint, value, step, min, onChange }: FieldProps) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '11px', color: 'var(--frost)', marginBottom: '3px' }}>
        {label}
      </label>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          color: 'var(--frost)',
          fontSize: '12px',
          padding: '5px 8px',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ fontSize: '9px', color: 'var(--mist)', marginTop: '2px' }}>{hint}</div>
    </div>
  );
}
