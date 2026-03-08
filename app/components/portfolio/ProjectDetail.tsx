'use client';
/**
 * ProjectDetail — Sprint 24.0
 *
 * Slide-in panel from right (same pattern as InspectorDrawer).
 * Shows full project info + STATUS.md excerpt.
 * "Start Working" dispatches greglite:set-project custom event.
 * Escape key + close button to dismiss.
 */


import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, Play } from 'lucide-react';
import { drawerSlide } from '@/lib/design/animations';
import { formatRelativeTime, PORTFOLIO } from '@/lib/voice/copy-templates';
import type { ProjectCard } from '@/lib/portfolio/types';

interface ProjectDetailProps {
  project: ProjectCard | null;
  statusFull?: string | null;
  onClose: () => void;
  onRefresh?: (() => void) | undefined;
}

export function ProjectDetail({ project, statusFull, onClose, onRefresh }: ProjectDetailProps) {
  // Escape key to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleStartWorking = () => {
    if (!project) return;
    window.dispatchEvent(
      new CustomEvent('greglite:set-project', {
        detail: { projectId: project.id, path: project.path, name: project.name },
      })
    );
    onClose();
  };

  return (
    <AnimatePresence>
      {project && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'var(--backdrop, rgba(0,0,0,0.4))',
              zIndex: 40,
            }}
          />

          {/* Panel */}
          <motion.div
            variants={drawerSlide}
            initial="hidden"
            animate="visible"
            exit="hidden"
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 400,
              maxWidth: '90vw',
              background: 'var(--elevated)',
              borderLeft: '1px solid var(--shadow)',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '14px 16px',
                borderBottom: '1px solid var(--shadow)',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  flex: 1,
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--ice-white)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {project.name}
              </span>
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  title={PORTFOLIO.refreshButton}
                  style={iconBtnStyle}
                  aria-label={PORTFOLIO.refreshButton}
                >
                  <RefreshCw size={14} />
                </button>
              )}
              <button
                onClick={onClose}
                title={PORTFOLIO.detail.close}
                style={iconBtnStyle}
                aria-label={PORTFOLIO.detail.close}
              >
                <X size={14} />
              </button>
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
              {/* Meta rows */}
              <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <MetaRow label={PORTFOLIO.detail.type}        value={project.typeLabel} />
                <MetaRow label={PORTFOLIO.detail.version}     value={project.version ?? PORTFOLIO.detail.noVersion} />
                <MetaRow label={PORTFOLIO.detail.phase}       value={project.phase ?? PORTFOLIO.detail.noPhase} multiline />
                <MetaRow
                  label={PORTFOLIO.detail.lastActivity}
                  value={
                    project.lastActivity
                      ? formatRelativeTime(project.lastActivity)
                      : PORTFOLIO.detail.noLastActivity
                  }
                />
                <MetaRow
                  label={PORTFOLIO.detail.health}
                  value={project.healthReason}
                  accent={
                    project.health === 'green'
                      ? '#22c55e'
                      : project.health === 'amber'
                      ? '#f59e0b'
                      : '#ef4444'
                  }
                />
                {project.nextAction && (
                  <MetaRow label={PORTFOLIO.detail.nextAction} value={project.nextAction} multiline />
                )}
                {project.testCount !== undefined && (
                  <MetaRow
                    label="Tests"
                    value={PORTFOLIO.detail.testsPassing(
                      project.testPassing ?? project.testCount,
                      project.testCount
                    )}
                    accent={
                      project.testPassing === project.testCount ? '#22c55e' : '#ef4444'
                    }
                  />
                )}
                {project.tscErrors !== undefined && (
                  <MetaRow
                    label="TypeScript"
                    value={PORTFOLIO.detail.tscErrors(project.tscErrors)}
                    accent={project.tscErrors === 0 ? '#22c55e' : '#ef4444'}
                  />
                )}
                <MetaRow label={PORTFOLIO.detail.path} value={project.path} mono />
              </dl>

              {/* STATUS excerpt */}
              {statusFull && (
                <div style={{ marginTop: 20 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--mist)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: 8,
                    }}
                  >
                    {PORTFOLIO.detail.statusExcerpt}
                  </div>
                  <pre
                    style={{
                      fontSize: 11,
                      color: 'var(--frost)',
                      background: 'var(--surface)',
                      border: '1px solid var(--shadow)',
                      borderRadius: 6,
                      padding: '10px 12px',
                      overflowX: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      margin: 0,
                      fontFamily: 'monospace',
                      lineHeight: 1.5,
                    }}
                  >
                    {statusFull}
                  </pre>
                </div>
              )}

              {!statusFull && (
                <p style={{ fontSize: 12, color: 'var(--mist)', marginTop: 20 }}>
                  {PORTFOLIO.detail.noStatus}
                </p>
              )}
            </div>

            {/* Footer: Start Working */}
            <div
              style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--shadow)',
                flexShrink: 0,
              }}
            >
              <button
                onClick={handleStartWorking}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  borderRadius: 6,
                  border: '1px solid var(--cyan)',
                  background: 'rgba(0, 212, 232, 0.08)',
                  color: 'var(--cyan)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0, 212, 232, 0.16)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0, 212, 232, 0.08)';
                }}
              >
                <Play size={13} />
                {PORTFOLIO.detail.startWorking}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface MetaRowProps {
  label: string;
  value: string;
  accent?: string;
  mono?: boolean;
  multiline?: boolean;
}

function MetaRow({ label, value, accent, mono, multiline }: MetaRowProps) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: multiline ? 'flex-start' : 'center' }}>
      <dt
        style={{
          fontSize: 11,
          color: 'var(--mist)',
          fontWeight: 500,
          minWidth: 88,
          flexShrink: 0,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          paddingTop: multiline ? 1 : 0,
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          fontSize: 12,
          color: accent ?? 'var(--frost)',
          margin: 0,
          fontFamily: mono ? 'monospace' : undefined,
          wordBreak: mono ? 'break-all' : 'break-word',
          flex: 1,
        }}
      >
        {value}
      </dd>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--mist)',
  padding: 4,
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'color 0.15s',
};
