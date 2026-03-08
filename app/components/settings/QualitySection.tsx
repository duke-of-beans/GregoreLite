import { apiFetch } from '@/lib/api-client';
/**
 * QualitySection — S9-13
 * Code quality thresholds and pattern analysis retry settings.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface QualityField {
  key: string;
  label: string;
  description: string;
  fallback: string;
  step: string;
  min: string;
}

const FIELDS: QualityField[] = [
  { key: 'eos_soft_threshold', label: 'Quality Warning', description: 'Show a warning when quality drops below this score', fallback: '0.6', step: '0.05', min: '0' },
  { key: 'eos_hard_threshold', label: 'Quality Alert', description: 'Flag the session when quality drops below this score', fallback: '0.4', step: '0.05', min: '0' },
  { key: 'shim_retry_ceiling', label: 'Auto-Retry Limit', description: 'Max automatic retries before asking you to decide', fallback: '3', step: '1', min: '1' },
];

export function QualitySection() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const res = await apiFetch('/api/settings');
      if (res.ok) {
        const body = await res.json() as { data: Record<string, string> };
        setValues(body.data);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { void loadSettings(); }, [loadSettings]);

  async function handleSave(key: string, value: string) {
    setSaving(true);
    try {
      await apiFetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
    } catch { /* silent */ }
    setSaving(false);
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ice-white)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Code Quality
      </h3>
      <p style={{ fontSize: 11, color: 'var(--frost)', opacity: 0.7, marginBottom: 12 }}>Analysis thresholds and retry behavior</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {FIELDS.map((f) => (
          <div key={f.key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ flex: 1, fontSize: 13, color: 'var(--frost)' }}>{f.label}</label>
              <input
                type="number"
                step={f.step}
                min={f.min}
                value={values[f.key] ?? f.fallback}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                onBlur={(e) => void handleSave(f.key, e.target.value)}
                disabled={saving}
                style={{
                  width: 70,
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--shadow)',
                  background: 'var(--elevated)',
                  color: 'var(--ice-white)',
                  fontSize: 13,
                  textAlign: 'right',
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: 'var(--frost)', opacity: 0.7, marginTop: 2, paddingLeft: 2 }}>{f.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}