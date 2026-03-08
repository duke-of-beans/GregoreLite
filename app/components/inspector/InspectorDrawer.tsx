'use client';
/**
 * InspectorDrawer — Sprint S9-14
 * Spring animation — Sprint 21.0
 *
 * Right slide-in drawer with 6 tabs: Thread, Memory, Quality, Jobs, Costs, Learning.
 * Opens via Cmd+I or command palette.
 *
 * Animation: AnimatePresence + motion.div spring (stiffness 300, damping 30).
 * Backdrop: fadeIn. Drawer: drawerSlide (springs in from right, eases out).
 */


import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KernlTab } from './KernlTab';
import { QualityTab } from './QualityTab';
import { JobsTab } from './JobsTab';
import { CostBreakdown } from '@/components/agent-sdk/CostBreakdown';
import { InsightReviewPanel } from '@/components/transit/InsightReviewPanel';
import { MemoryTab } from './MemoryTab';
import { fadeIn, drawerSlide } from '@/lib/design/animations';

type InspectorTab = 'kernl' | 'quality' | 'costs' | 'jobs' | 'learning' | 'recall';

interface TabDef {
  id: InspectorTab;
  label: string;
  icon: string;
  tooltip: string;
}

const TABS: TabDef[] = [
  { id: 'kernl',   label: 'Memory',   icon: '🧠', tooltip: 'Cross-session memory — powered by KERNL' },
  { id: 'recall',  label: 'Recall',   icon: '💭', tooltip: 'Ambient memory highlights — Sprint 27.0' },
  { id: 'quality', label: 'Quality',  icon: '📊', tooltip: 'Code quality analysis — powered by Eye of Sauron' },
  { id: 'costs',   label: 'Cost',     icon: '💰', tooltip: 'Token usage and spend breakdown' },
  { id: 'jobs',    label: 'Jobs',     icon: '⚡', tooltip: 'Background tasks and workers' },
  { id: 'learning',label: 'Learning', icon: '🔮', tooltip: 'Insights and patterns from your sessions' },
];

interface InspectorDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function InspectorDrawer({ open, onClose }: InspectorDrawerProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('kernl');

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

  const handleTabClick = useCallback((tabId: InspectorTab) => {
    setActiveTab(tabId);
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — fades in/out */}
          <motion.div
            key="inspector-backdrop"
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 199,
            }}
          />

          {/* Drawer — springs in from right */}
          <motion.div
            data-tour="inspector-drawer"
            key="inspector-drawer"
            variants={drawerSlide}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 440,
              background: 'rgba(10, 14, 20, 0.95)',
              backdropFilter: 'blur(12px)',
              borderLeft: '1px solid rgba(0, 212, 232, 0.15)',
              boxShadow: '-4px 0 32px rgba(0, 0, 0, 0.5)',
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
              padding: '12px 16px',
              borderBottom: '1px solid var(--shadow)',
            }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ice-white)', margin: 0 }}>
                🔍 Inspector
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
                aria-label="Close inspector"
              >
                ✕
              </button>
            </div>

            {/* Tab bar */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid var(--shadow)',
              padding: '0 8px',
            }}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  title={tab.tooltip}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === tab.id ? '2px solid var(--cyan)' : '2px solid transparent',
                    color: activeTab === tab.id ? 'var(--ice-white)' : 'var(--frost)',
                    cursor: 'pointer',
                    fontSize: 11,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: 14 }}>{tab.icon}</span>
                  <span className="hidden lg:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: 16,
            }}>
              {activeTab === 'kernl'    && <KernlTab />}
              {activeTab === 'recall'   && <MemoryTab />}
              {activeTab === 'quality'  && <QualityTab />}
              {activeTab === 'costs'    && <CostBreakdown onClose={onClose} />}
              {activeTab === 'jobs'     && <JobsTab />}
              {activeTab === 'learning' && <InsightReviewPanel />}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
