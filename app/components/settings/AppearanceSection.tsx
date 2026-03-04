/**
 * AppearanceSection — Sprint 10.8 Task 8
 * Theme toggle + density selector.
 */

'use client';

import { useUIStore, type ThemeMode } from '@/lib/stores/ui-store';
import { useDensityStore, type Density } from '@/lib/stores/density-store';


const THEMES: { value: ThemeMode; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: '☀' },
  { value: 'dark', label: 'Dark', icon: '🌙' },
  { value: 'system', label: 'System', icon: '💻' },
];

const DENSITIES: { value: Density; label: string; icon: string; hint: string }[] = [
  { value: 'compact',     label: 'Compact',     icon: '▤', hint: 'Dense — Cmd+Shift+-' },
  { value: 'comfortable', label: 'Comfortable', icon: '▦', hint: 'Default — balanced spacing' },
  { value: 'spacious',    label: 'Spacious',    icon: '▧', hint: 'Airy — Cmd+Shift+=' },
];

export function AppearanceSection() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const density = useDensityStore((s) => s.density);
  const setDensity = useDensityStore((s) => s.setDensity);
  const showTransitMetadata = useUIStore((s) => s.showTransitMetadata);
  const toggleTransitMetadata = useUIStore((s) => s.toggleTransitMetadata);

  const btnBase: React.CSSProperties = {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    transition: 'all 0.15s ease',
  };

  const activeStyle: React.CSSProperties = {
    ...btnBase,
    border: '2px solid var(--cyan)',
    background: 'var(--surface)',
    color: 'var(--ice-white)',
  };

  const inactiveStyle: React.CSSProperties = {
    ...btnBase,
    border: '1px solid var(--shadow)',
    background: 'var(--elevated)',
    color: 'var(--frost)',
  };

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Theme toggle */}
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ice-white)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Appearance
      </h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {THEMES.map((t) => (
          <button
            key={t.value}
            onClick={() => setTheme(t.value)}
            style={theme === t.value ? activeStyle : inactiveStyle}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Density selector */}
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ice-white)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Message Density
      </h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {DENSITIES.map((d) => (
          <button
            key={d.value}
            onClick={() => setDensity(d.value)}
            title={d.hint}
            style={density === d.value ? activeStyle : inactiveStyle}
          >
            <span style={{ fontSize: 16 }}>{d.icon}</span>
            <span>{d.label}</span>
          </button>
        ))}
      </div>

      {/* Transit Map annotations toggle */}
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ice-white)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Transit Map
      </h3>
      <div
        onClick={toggleTransitMetadata}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
          background: 'var(--elevated)', border: `1px solid ${showTransitMetadata ? 'var(--cyan)' : 'var(--shadow)'}`,
          transition: 'border-color 0.15s',
        }}
      >
        <div>
          <div style={{ fontSize: 13, color: 'var(--ice-white)', fontWeight: 500 }}>
            Show message annotations
          </div>
          <div style={{ fontSize: 11, color: 'var(--mist)', marginTop: 2 }}>
            Model badge, token counts, cost, latency, event markers — Cmd+Shift+M
          </div>
        </div>
        {/* Toggle pill */}
        <div style={{
          width: 36, height: 20, borderRadius: 10, flexShrink: 0, marginLeft: 12,
          background: showTransitMetadata ? 'var(--cyan)' : 'var(--shadow)',
          position: 'relative', transition: 'background 0.2s',
        }}>
          <div style={{
            position: 'absolute', top: 2,
            left: showTransitMetadata ? 18 : 2,
            width: 16, height: 16, borderRadius: '50%',
            background: showTransitMetadata ? 'var(--deep-space)' : 'var(--frost)',
            transition: 'left 0.2s',
          }} />
        </div>
      </div>
    </div>
  );
}
