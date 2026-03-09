'use client';
/**
 * ProjectDetail — Sprint 24.0
 *
 * Slide-in panel from right (same pattern as InspectorDrawer).
 * Shows full project info + STATUS.md excerpt.
 * "Start Working" dispatches greglite:set-project custom event.
 * Escape key + close button to dismiss.
 */


import { useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, Play, Pencil, Check, Trash2, AlertTriangle, ChevronDown } from 'lucide-react';
import { drawerSlide } from '@/lib/design/animations';
import { formatRelativeTime, PORTFOLIO } from '@/lib/voice/copy-templates';
import { apiFetch } from '@/lib/api-client';
import type { ProjectCard, ProjectType, PatchProjectBody } from '@/lib/portfolio/types';

interface ProjectDetailProps {
  project: ProjectCard | null;
  statusFull?: string | null;
  onClose: () => void;
  onRefresh?: (() => void) | undefined;
  onRemove?: (id: string, exclude: boolean) => void;
  onProjectUpdate?: (id: string, patch: PatchProjectBody) => void;
}

export function ProjectDetail({ project, statusFull, onClose, onRefresh, onRemove, onProjectUpdate }: ProjectDetailProps) {
  // Edit state
  const [editOpen, setEditOpen]         = useState(false);
  const [editName, setEditName]         = useState('');
  const [editType, setEditType]         = useState<ProjectType>('custom');
  const [saveState, setSaveState]       = useState<'idle' | 'saving' | 'saved'>('idle');
  const [removing, setRemoving]         = useState<false | 'confirm'>(false);

  // Reset edit state when project changes
  useEffect(() => {
    if (project) {
      setEditName(project.name);
      setEditType(project.type);
      setSaveState('idle');
      setEditOpen(false);
      setRemoving(false);
    }
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleSave = async () => {
    if (!project) return;
    const patch: PatchProjectBody = {};
    if (editName.trim() && editName.trim() !== project.name) patch.name = editName.trim();
    if (editType !== project.type) patch.type = editType;
    if (Object.keys(patch).length === 0) { setSaveState('saved'); setTimeout(() => setSaveState('idle'), 1500); return; }
    setSaveState('saving');
    try {
      await apiFetch(`/api/portfolio/${encodeURIComponent(project.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      setSaveState('saved');
      onProjectUpdate?.(project.id, patch);
      setTimeout(() => setSaveState('idle'), 1800);
    } catch {
      setSaveState('idle');
    }
  };

  const handleRemove = async (exclude: boolean) => {
    if (!project) return;
    try {
      await apiFetch(`/api/portfolio/${encodeURIComponent(project.id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exclude, reason: 'User removed' }),
      });
      onRemove?.(project.id, exclude);
      onClose();
    } catch { /* silent — parent will handle */ }
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

              {/* ── Edit section ── */}
              <div style={{ marginTop: 20, borderTop: '1px solid var(--shadow)', paddingTop: 14 }}>
                <button
                  onClick={() => setEditOpen((v) => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--mist)', fontSize: 11, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.05em', padding: 0,
                  }}
                >
                  <Pencil size={11} />
                  Edit
                  <ChevronDown size={11} style={{ transform: editOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                </button>

                {editOpen && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Name */}
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--mist)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Name</label>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          background: 'var(--surface)', border: '1px solid var(--shadow)',
                          borderRadius: 4, padding: '6px 8px',
                          color: 'var(--ice-white)', fontSize: 12,
                          outline: 'none', fontFamily: 'inherit',
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--cyan)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--shadow)'; }}
                      />
                    </div>

                    {/* Type */}
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--mist)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Type</label>
                      <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value as ProjectType)}
                        style={{
                          width: '100%',
                          background: 'var(--surface)', border: '1px solid var(--shadow)',
                          borderRadius: 4, padding: '6px 8px',
                          color: 'var(--ice-white)', fontSize: 12,
                          outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        <option value="code">Code</option>
                        <option value="research">Research</option>
                        <option value="business">Business</option>
                        <option value="creative">Creative</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>

                    {/* Save button */}
                    <button
                      onClick={() => { void handleSave(); }}
                      disabled={saveState === 'saving'}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '7px 14px', borderRadius: 4,
                        border: '1px solid var(--cyan)',
                        background: saveState === 'saved' ? 'rgba(34,197,94,0.12)' : 'rgba(0,212,232,0.08)',
                        color: saveState === 'saved' ? '#4ade80' : 'var(--cyan)',
                        fontSize: 12, fontWeight: 600, cursor: saveState === 'saving' ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {saveState === 'saved' ? <><Check size={12} /> Saved ✓</> : saveState === 'saving' ? 'Saving…' : 'Save'}
                    </button>

                    {/* Remove button */}
                    {removing === false ? (
                      <button
                        onClick={() => setRemoving('confirm')}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          padding: '6px 14px', borderRadius: 4,
                          border: '1px solid rgba(239,68,68,0.4)',
                          background: 'rgba(239,68,68,0.06)',
                          color: '#ef4444', fontSize: 12, cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={12} />
                        Remove project
                      </button>
                    ) : (
                      <div style={{
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 6, padding: '10px 12px',
                        display: 'flex', flexDirection: 'column', gap: 8,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', fontSize: 11, fontWeight: 600 }}>
                          <AlertTriangle size={11} />
                          Remove {project?.name}?
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => { void handleRemove(false); }}
                            style={{ flex: 1, padding: '5px 8px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                          >
                            Remove
                          </button>
                          <button
                            onClick={() => { void handleRemove(true); }}
                            style={{ flex: 1, padding: '5px 8px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                            title="Also prevents scanner from re-adding this path"
                          >
                            Remove &amp; Don&apos;t rescan
                          </button>
                          <button
                            onClick={() => setRemoving(false)}
                            style={{ padding: '5px 8px', borderRadius: 4, border: '1px solid var(--shadow)', background: 'none', color: 'var(--mist)', fontSize: 11, cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

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
