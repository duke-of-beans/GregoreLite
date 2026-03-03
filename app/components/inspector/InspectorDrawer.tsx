/**
 * InspectorDrawer — Sprint S9-14
 *
 * Right slide-in drawer with 5 tabs: Thread, KERNL, Quality, Jobs, Costs.
 * Opens via Cmd+I or command palette.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { ThreadTab } from './ThreadTab';
import { KernlTab } from './KernlTab';
import { QualityTab } from './QualityTab';
import { JobsTab } from './JobsTab';
import { CostBreakdown } from '@/components/agent-sdk/CostBreakdown';

type InspectorTab = 'thread' | 'kernl' | 'quality' | 'jobs' | 'costs';

interface TabDef {
  id: InspectorTab;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { id: 'thread', label: 'Thread', icon: '💬' },
  { id: 'kernl', label: 'KERNL', icon: '🧠' },
  { id: 'quality', label: 'Quality', icon: '📊' },
  { id: 'jobs', label: 'Jobs', icon: '⚡' },
  { id: 'costs', label: 'Costs', icon: '💰' },
];

interface InspectorDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function InspectorDrawer({ open, onClose }: InspectorDrawerProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('thread');
  const [showCostModal, setShowCostModal] = useState(false);

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

  // When costs tab selected, show embedded cost breakdown
  const handleTabClick = useCallback((tabId: InspectorTab) => {
    if (tabId === 'costs') {
      setShowCostModal(true);
    } else {
      setShowCostModal(false);
    }
    setActiveTab(tabId);
  }, []);

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
          width: 440,
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
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
        }}>
          {activeTab === 'thread' && <ThreadTab />}
          {activeTab === 'kernl' && <KernlTab />}
          {activeTab === 'quality' && <QualityTab />}
          {activeTab === 'jobs' && <JobsTab />}
          {activeTab === 'costs' && showCostModal && (
            <CostBreakdown onClose={() => setShowCostModal(false)} />
          )}
        </div>
      </div>
    </>
  );
}