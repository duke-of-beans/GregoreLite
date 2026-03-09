'use client';
/**
 * SettingsPanel — Sprint 39.0
 *
 * Centered full-window overlay modal (80vw / max 1000px, 85vh / max 700px).
 * Two-column layout: 180px left sidebar (vertical tab nav) + flex-1 right content.
 * Framer Motion: scale 0.96→1, opacity 0→1, 0.2s ease-out.
 * Active tab: left cyan border accent + rgba(0,212,255,0.08) background tint.
 * UIStore settingsActiveTab keys unchanged from Sprint 37.0.
 *
 * Replaces: 400px right slide-in drawer (Sprint 37.0).
 */


import { useEffect, useRef } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  Palette,
  Brain,
  Banknote,
  Rocket,
  Settings2,
} from 'lucide-react';
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

// Tab key type derived from SETTINGS_TABS (unchanged from Sprint 37.0)
type SettingsTab = keyof typeof SETTINGS_TABS;

const TAB_ORDER: SettingsTab[] = [
  'appearance',
  'memory_ghost',
  'budget_quality',
  'startup_sync',
  'advanced',
];

const TAB_ICONS: Record<SettingsTab, React.ReactNode> = {
  appearance:    <Palette   size={14} />,
  memory_ghost:  <Brain     size={14} />,
  budget_quality:<Banknote  size={14} />,
  startup_sync:  <Rocket    size={14} />,
  advanced:      <Settings2 size={14} />,
};

const backdropVariants: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit:    { opacity: 0, transition: { duration: 0.1 } },
};

const modalVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: 'easeOut' } },
  exit:    { opacity: 0, scale: 0.96, transition: { duration: 0.15 } },
};

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const activeTab = useUIStore((s) => s.settingsActiveTab) as SettingsTab;
  const setActiveTab = useUIStore((s) => s.setSettingsActiveTab);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Position guard: on small windows, anchor to left instead of centering
  const isSmallWindow = typeof window !== 'undefined' && window.innerWidth < 600;

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

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="settings-backdrop"
            ref={backdropRef}
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              zIndex: 199,
            }}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            key="settings-modal"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            drag
            dragConstraints={backdropRef}
            dragMomentum={false}
            dragElastic={0}
            whileDrag={{ cursor: 'grabbing' }}
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            style={{
              position: 'fixed',
              top: '50%',
              left: isSmallWindow ? 20 : '50%',
              transform: isSmallWindow ? 'translateY(-50%)' : 'translate(-50%, -50%)',
              width: '80vw',
              maxWidth: 1000,
              minWidth: 560,
              height: '85vh',
              maxHeight: 700,
              minHeight: 400,
              background: 'var(--deep-space)',
              border: '1px solid var(--shadow)',
              borderRadius: 12,
              zIndex: 200,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
            }}
          >
            {/* Modal header — drag handle */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 20px',
              borderBottom: '1px solid var(--shadow)',
              background: 'var(--elevated)',
              flexShrink: 0,
              cursor: 'grab',
              userSelect: 'none',
            }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ice-white)', margin: 0, letterSpacing: '0.02em' }}>
                Settings
              </h2>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--frost)',
                  cursor: 'pointer',
                  fontSize: 18,
                  padding: '2px 6px',
                  borderRadius: 4,
                  lineHeight: 1,
                }}
                aria-label="Close settings"
              >
                ✕
              </button>
            </div>

            {/* Two-column body */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

              {/* Left sidebar — vertical tab nav */}
              <div style={{
                width: 180,
                flexShrink: 0,
                background: 'var(--elevated)',
                borderRight: '1px solid var(--shadow)',
                overflowY: 'auto',
                padding: '8px 0',
              }}>
                {TAB_ORDER.map((tab) => {
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        padding: '9px 16px',
                        border: 'none',
                        borderLeft: isActive
                          ? '2px solid var(--cyan)'
                          : '2px solid transparent',
                        background: isActive
                          ? 'rgba(0, 212, 255, 0.08)'
                          : 'transparent',
                        color: isActive ? 'var(--cyan)' : 'var(--frost)',
                        fontSize: 12,
                        fontWeight: isActive ? 600 : 400,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.12s ease',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ opacity: isActive ? 1 : 0.6, flexShrink: 0 }}>
                        {TAB_ICONS[tab]}
                      </span>
                      {SETTINGS_TABS[tab]}
                    </button>
                  );
                })}
              </div>

              {/* Right content — scrollable */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
