/**
 * TourSection — Sprint 38.0
 *
 * Settings panel section for restarting the onboarding tour.
 * Calls resetTour() → startTour() with 300ms delay so SettingsPanel
 * has time to close before the first tooltip fires.
 */

'use client';

import { useUIStore } from '@/lib/stores/ui-store';
import { TOUR } from '@/lib/voice/copy-templates';

export function TourSection() {
  const resetTour    = useUIStore((s) => s.resetTour);
  const startTour    = useUIStore((s) => s.startTour);
  const setSettings  = useUIStore((s) => s.setSettingsOpen);

  const handleRestart = () => {
    // Close settings first so tooltips aren't obscured
    setSettings(false);
    resetTour();
    setTimeout(() => {
      startTour();
    }, 300);
  };

  return (
    <section>
      <h3 style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--mist)',
        margin: '0 0 12px',
      }}>
        {TOUR.restart_label}
      </h3>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <p style={{ fontSize: 12, color: 'var(--frost)', margin: 0, flex: 1 }}>
          {TOUR.restart_description}
        </p>
        <button
          onClick={handleRestart}
          style={{
            flexShrink: 0,
            padding: '6px 14px',
            background: 'none',
            border: '1px solid var(--shadow)',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
            color: 'var(--frost)',
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--cyan)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--ice-white)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--shadow)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--frost)';
          }}
        >
          {TOUR.restart_label}
        </button>
      </div>
    </section>
  );
}
