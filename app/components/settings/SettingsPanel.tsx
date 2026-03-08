/**
 * SettingsPanel — Sprint 37.0
 *
 * Right slide-in drawer (400px) with horizontal pill tab groups.
 * 5 tabs: Appearance / Memory & Ghost / Budget & Quality / Startup & Sync / Advanced
 * Active tab persisted in UIStore as settingsActiveTab.
 */

'use client';

import { useEffect } from 'react';
import { AppearanceSection } from './AppearanceSection';
import { BudgetSection } from './BudgetSection';
import { QualitySection } from './QualitySection';
import { GhostSection } from './GhostSection';
import { AegisSection } from './AegisSection';
import { ApiSection } from './ApiSection';
import { OverridePoliciesSection } from './OverridePoliciesSection';
import { TourSection } from './TourSection';
import { RecallSection } from './RecallSection';
import { CaptureSection } from './CaptureSection';
import { StartupSection } from './StartupSection';
import { WebSessionSection } from './WebSessionSection';
import { ImportSection } from './ImportSection';
import { useUIStore } from '@/lib/stores/ui-store';
import { SETTINGS_TABS } from '@/lib/voice/copy-templates';

// Tab key type derived from SETTINGS_TABS
type SettingsTab = keyof typeof SETTINGS_TABS;

const TAB_ORDER: SettingsTab[] = [
  'appearance',
  'memory_ghost',
  'budget_quality',
  'startup_sync',
  'advanced',
];

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const activeTab = useUIStore((s) => s.settingsActiveTab) as SettingsTab;
  const setActiveTab = useUIStore((s) => s.setSettingsActiveTab);

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
          flexShrink: 0,
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

        {/* Tab pills */}
        <div style={{
          display: 'flex',
          gap: 6,
          padding: '12px 16px 0',
          flexShrink: 0,
          overflowX: 'auto',
          borderBottom: '1px solid var(--shadow)',
          paddingBottom: 12,
        }}>
          {TAB_ORDER.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flexShrink: 0,
                  padding: '5px 12px',
                  borderRadius: 20,
                  border: isActive
                    ? '1px solid var(--cyan)'
                    : '1px solid var(--shadow)',
                  background: isActive
                    ? 'rgba(0, 212, 255, 0.12)'
                    : 'transparent',
                  color: isActive ? 'var(--cyan)' : 'var(--frost)',
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {SETTINGS_TABS[tab]}
              </button>
            );
          })}
        </div>

        {/* Scrollable tab content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
        }}>
          {activeTab === 'appearance' && (
            <AppearanceSection />
          )}

          {activeTab === 'memory_ghost' && (
            <>
              <GhostSection />
              <div style={{ height: 1, background: 'var(--shadow)', margin: '16px 0' }} />
              <RecallSection />
              <div style={{ height: 1, background: 'var(--shadow)', margin: '16px 0' }} />
              <ImportSection />
              <div style={{ height: 1, background: 'var(--shadow)', margin: '16px 0' }} />
              <WebSessionSection />
            </>
          )}

          {activeTab === 'budget_quality' && (
            <>
              <BudgetSection />
              <div style={{ height: 1, background: 'var(--shadow)', margin: '16px 0' }} />
              <QualitySection />
              <div style={{ height: 1, background: 'var(--shadow)', margin: '16px 0' }} />
              <OverridePoliciesSection />
            </>
          )}

          {activeTab === 'startup_sync' && (
            <StartupSection />
          )}

          {activeTab === 'advanced' && (
            <>
              <AegisSection />
              <div style={{ height: 1, background: 'var(--shadow)', margin: '16px 0' }} />
              <ApiSection />
              <div style={{ height: 1, background: 'var(--shadow)', margin: '16px 0' }} />
              <CaptureSection />
              <div style={{ height: 1, background: 'var(--shadow)', margin: '16px 0' }} />
              {/* Sprint 38.0: Restart onboarding tour */}
              <TourSection />
            </>
          )}
        </div>
      </div>
    </>
  );
}
