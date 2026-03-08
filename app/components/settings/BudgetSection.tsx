'use client';
import { apiFetch } from '@/lib/api-client';
/**
 * BudgetSection — S9-13
 * Session soft/hard caps, daily hard cap — reads/writes budget_config.
 */


import { useState, useEffect, useCallback } from 'react';

interface BudgetField {
  key: string;
  label: string;
  unit: string;
  fallback: string;
}

const FIELDS: BudgetField[] = [
  { key: 'session_soft_cap_usd', label: 'Session Soft Cap', unit: '$', fallback: '2.00' },
  { key: 'session_hard_cap_usd', label: 'Session Hard Cap', unit: '$', fallback: '10.00' },
  { key: 'daily_hard_cap_usd', label: 'Daily Hard Cap', unit: '$', fallback: '15.00' },
];

export function BudgetSection() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dailySpend, setDailySpend] = useState<number | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const res = await apiFetch('/api/settings');
      if (res.ok) {
        const body = await res.json() as { data: Record<string, string> };
        setValues(body.data);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    void loadSettings();
    // Also fetch today's spend
    void (async () => {
      try {
        // Sprint 10.9 Task 9: use /api/costs/today (correct route)
        const res = await apiFetch('/api/costs/today');
        if (res.ok) {
          const body = await res.json() as { data?: { totalUsd: number } };
          if (body.data) setDailySpend(body.data.totalUsd);
        }
      } catch { /* silent */ }
    })();
  }, [loadSettings]);

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
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ice-white)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Budget
      </h3>
      {dailySpend !== null && (
        <div style={{ fontSize: 12, color: 'var(--frost)', marginBottom: 12, padding: '8px 12px', background: 'var(--surface)', borderRadius: 6 }}>
          Today&apos;s spend: <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>${dailySpend.toFixed(2)}</span>
          {' / '}
          <span style={{ color: 'var(--frost)' }}>${values.daily_hard_cap_usd ?? '15.00'} cap</span>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {FIELDS.map((f) => (
          <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ flex: 1, fontSize: 13, color: 'var(--frost)' }}>{f.label}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 13, color: 'var(--frost)' }}>{f.unit}</span>
              <input
                type="number"
                step="0.50"
                min="0"
                value={values[f.key] ?? f.fallback}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                onBlur={(e) => void handleSave(f.key, e.target.value)}
                disabled={saving}
                style={{
                  width: 80,
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
          </div>
        ))}
      </div>
    </div>
  );
}