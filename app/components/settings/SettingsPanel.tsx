/**
 * SettingsPanel — Sprint S9-13
 *
 * Right slide-in drawer (400px) with settings sections.
 * Accessible via Cmd+, or command palette.
 */

'use client';

import { useEffect } from 'react';
import { AppearanceSection } from './AppearanceSection';
import { BudgetSection } from './BudgetSection';
import { QualitySection } from './QualitySection';
import { GhostSection } from './GhostSection';
import { AegisSection } from './AegisSection';
import { ApiSection } from './ApiSection';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 199,
        }}
      />
      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 400,
          background: 'var(--deep-space)',
          borderLeft: '1px solid var(--shadow)',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--shadow)',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ice-white)', margin: 0 }}>
            ⚙ Settings
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--frost)',
              cursor: 'pointer',
              fontSize: 18,
              padding: '4px 8px',
              borderRadius: 4,
            }}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
        }}>
          <AppearanceSection />

          <div style={{ height: 1, background: 'var(--shadow)', margin: '16px 0' }} />
          <BudgetSection />

          <div style={{ height: 1, background: 'var(--shadow)', margin: '16px 0' }} />
          <QualitySection />

          <div style={{ height: 1, background: 'var(--shadow)', margin: '16px 0' }} />
          <GhostSection />

          <div style={{ height: 1, background: 'var(--shadow)', margin: '16px 0' }} />
          <AegisSection />

          <div style={{ height: 1, background: 'var(--shadow)', margin: '16px 0' }} />
          <ApiSection />
        </div>
      </div>
    </>
  );
}