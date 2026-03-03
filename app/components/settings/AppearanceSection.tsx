/**
 * AppearanceSection — S9-13
 * Theme toggle: Light / Dark / System with live preview.
 */

'use client';

import { useUIStore, type ThemeMode } from '@/lib/stores/ui-store';

const THEMES: { value: ThemeMode; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: '☀' },
  { value: 'dark', label: 'Dark', icon: '🌙' },
  { value: 'system', label: 'System', icon: '💻' },
];

export function AppearanceSection() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ice-white)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Appearance
      </h3>
      <div style={{ display: 'flex', gap: 8 }}>
        {THEMES.map((t) => (
          <button
            key={t.value}
            onClick={() => setTheme(t.value)}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 8,
              border: theme === t.value ? '2px solid var(--cyan)' : '1px solid var(--shadow)',
              background: theme === t.value ? 'var(--surface)' : 'var(--elevated)',
              color: theme === t.value ? 'var(--ice-white)' : 'var(--frost)',
              cursor: 'pointer',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}