/**
 * PortfolioDashboard — Sprint 24.0
 *
 * Main Portfolio tab view. Fetches from /api/portfolio on mount and every
 * 30 seconds. Renders responsive grid of ProjectCard components.
 * Clicking a card opens ProjectDetail slide-in panel.
 *
 * Simplified "Add Project" for Sprint 24: path text input + register button.
 * (Full Add Existing Project flow with scan + Q&A is Sprint 25.)
 *
 * Responsive grid: 3 columns at full width, 2 at <1024px, 1 at <768px.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, FolderKanban, Plus } from 'lucide-react';
import { PORTFOLIO } from '@/lib/voice/copy-templates';
import { ProjectCard } from './ProjectCard';
import { ProjectDetail } from './ProjectDetail';
import { AddProjectFlow } from './AddProjectFlow';
import AttentionQueue from './AttentionQueue';
import NewProjectFlow from './NewProjectFlow';
import type { ProjectCard as ProjectCardData, AttentionItem } from '@/lib/portfolio/types';

const POLL_INTERVAL_MS = 30_000;

// ── API response shapes ───────────────────────────────────────────────────────

interface ProjectsResponse {
  success: boolean;
  data?: { projects: ProjectCardData[]; total: number };
  error?: string;
}

interface DetailResponse {
  success: boolean;
  data?: {
    id: string;
    name: string;
    path: string;
    type: string;
    typeLabel: string;
    status: string;
    registeredAt: number;
    lastScannedAt: number | null;
    scanData: {
      statusFull?: string | null;
      statusExcerpt?: string | null;
    } | null;
  };
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--elevated)',
        border: '1px solid var(--shadow)',
        borderRadius: 8,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={skeletonBar(140, 14)} />
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={skeletonBar(52, 12)} />
        <div style={skeletonBar(60, 12)} />
      </div>
      <div style={skeletonBar(200, 11)} />
    </div>
  );
}

function skeletonBar(width: number | string, height: number): React.CSSProperties {
  return {
    width,
    height,
    borderRadius: 4,
    background: 'var(--surface)',
    animation: 'pulse 1.5s ease-in-out infinite',
  };
}

// (AddProjectRow removed in Sprint 25 — replaced by full AddProjectFlow modal)

// ── Main dashboard ────────────────────────────────────────────────────────────

export function PortfolioDashboard() {
  const [projects, setProjects] = useState<ProjectCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailStatusFull, setDetailStatusFull] = useState<string | null>(null);
  const [showAddFlow, setShowAddFlow] = useState(false);
  const [showNewFlow, setShowNewFlow] = useState(false);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchProjects = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/portfolio');
      const body = await res.json() as ProjectsResponse;
      if (body.success && body.data) {
        setProjects(body.data.projects);
        setError(null);
      } else {
        setError(PORTFOLIO.error(body.error ?? 'Unknown error'));
      }
    } catch (err) {
      setError(PORTFOLIO.error(err instanceof Error ? err.message : 'Network error'));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAttention = useCallback(async () => {
    try {
      const res = await fetch('/api/portfolio/attention');
      const body = await res.json() as { success: boolean; data?: { items: AttentionItem[] } };
      if (body.success && body.data) {
        setAttentionItems(body.data.items);
      }
    } catch { /* non-critical */ }
  }, []);

  const handleMute = useCallback(async (projectId: string, hours: number) => {
    try {
      await fetch('/api/portfolio/mute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, hours }),
      });
      // Optimistically remove from queue then re-fetch
      setAttentionItems((prev) => prev.filter((i) => i.projectId !== projectId));
      void fetchAttention();
    } catch { /* silent */ }
  }, [fetchAttention]);

  const handleDismiss = useCallback((projectId: string) => {
    // Optimistically remove from queue — session-only, no persistence
    setAttentionItems((prev) => prev.filter((i) => i.projectId !== projectId));
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetch('/api/portfolio/scan', { method: 'POST' });
      await fetchProjects(true);
    } catch { /* silent */ } finally {
      setRefreshing(false);
    }
  }, [fetchProjects]);

  const handleSelect = useCallback(async (id: string) => {
    setSelectedId(id);
    // Fetch detail for statusFull
    try {
      const res = await fetch(`/api/portfolio/${encodeURIComponent(id)}`);
      const body = await res.json() as DetailResponse;
      if (body.success && body.data) {
        setDetailStatusFull(body.data.scanData?.statusFull ?? body.data.scanData?.statusExcerpt ?? null);
      }
    } catch { setDetailStatusFull(null); }
  }, []);

  const handleClose = useCallback(() => {
    setSelectedId(null);
    setDetailStatusFull(null);
  }, []);

  // Mount + poll
  useEffect(() => {
    void fetchProjects();
    void fetchAttention();
    pollRef.current = setInterval(() => {
      void fetchProjects(true);
      void fetchAttention();
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchProjects, fetchAttention]);

  const selectedProject = projects.find((p) => p.id === selectedId) ?? null;

  // Build a map of projectId → severity for attention glow on cards
  const attentionMap = new Map(
    attentionItems.map((i) => [i.projectId, i.severity]),
  );

  const handleScrollToProject = useCallback((projectId: string) => {
    const el = document.querySelector(`[data-project-id="${projectId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  return (
    <div
      style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--deep-space)',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 20px',
          borderBottom: '1px solid var(--shadow)',
          flexShrink: 0,
        }}
      >
        <FolderKanban size={16} style={{ color: 'var(--cyan)', flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ice-white)', flex: 1 }}>
          Projects
        </span>
        {projects.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--mist)' }}>
            {projects.filter((p) => p.status === 'active').length} active
          </span>
        )}
        <button
          onClick={() => setShowNewFlow(true)}
          title="Create new project"
          style={{
            background: 'var(--elevated)',
            border: '1px solid var(--shadow)',
            borderRadius: 6,
            cursor: 'pointer',
            color: 'var(--cyan)',
            padding: '4px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            fontWeight: 500,
          }}
          aria-label="Create new project"
        >
          <Plus size={13} />
          New
        </button>
        <button
          onClick={() => setShowAddFlow(true)}
          title="Add existing project"
          style={{
            background: 'var(--elevated)',
            border: '1px solid var(--shadow)',
            borderRadius: 6,
            cursor: 'pointer',
            color: 'var(--cyan)',
            padding: '4px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            fontWeight: 500,
          }}
          aria-label="Add existing project"
        >
          <Plus size={13} />
          Add
        </button>
        <button
          onClick={() => { void handleRefresh(); }}
          disabled={refreshing}
          title={PORTFOLIO.refreshButton}
          style={{
            background: 'none',
            border: 'none',
            cursor: refreshing ? 'not-allowed' : 'pointer',
            color: 'var(--mist)',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label={PORTFOLIO.refreshButton}
        >
          <RefreshCw
            size={13}
            style={{
              transition: 'transform 0.6s',
              transform: refreshing ? 'rotate(360deg)' : 'none',
            }}
          />
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>

        {/* Attention queue — above grid, invisible when empty */}
        {attentionItems.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <AttentionQueue
              items={attentionItems}
              onProjectClick={handleScrollToProject}
              onMute={handleMute}
              onDismiss={handleDismiss}
            />
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={gridStyle}>
            {Array.from({ length: PORTFOLIO.skeletonCount }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{ color: 'var(--error)', fontSize: 13, padding: '20px 0' }}>
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && projects.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: '60px 20px',
              textAlign: 'center',
            }}
          >
            <FolderKanban size={32} style={{ color: 'var(--shadow)' }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--frost)', margin: 0 }}>
              {PORTFOLIO.empty.title}
            </p>
            <p style={{ fontSize: 12, color: 'var(--mist)', margin: 0, maxWidth: 360, lineHeight: 1.6 }}>
              {PORTFOLIO.empty.description}
            </p>
          </div>
        )}

        {/* Grid */}
        {!loading && !error && projects.length > 0 && (
          <div style={gridStyle} data-portfolio-grid>
            {projects.map((project) => (
              <div key={project.id} data-project-id={project.id}>
                <ProjectCard
                  project={project}
                  attentionSeverity={attentionMap.get(project.id)}
                  onSelect={(id) => { void handleSelect(id); }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail panel */}
      <ProjectDetail
        project={selectedProject}
        statusFull={detailStatusFull}
        onClose={handleClose}
        onRefresh={selectedProject ? () => { void handleRefresh(); } : undefined}
      />

      {/* Add existing project flow */}
      {showAddFlow && (
        <AddProjectFlow
          onComplete={() => {
            setShowAddFlow(false);
            void fetchProjects(true);
          }}
          onCancel={() => setShowAddFlow(false)}
        />
      )}

      {/* Create new project flow */}
      {showNewFlow && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNewFlow(false);
          }}
        >
          <NewProjectFlow
            onComplete={(projectId) => {
              setShowNewFlow(false);
              void fetchProjects(true);
              void fetchAttention();
              void handleSelect(projectId);
            }}
            onCancel={() => setShowNewFlow(false)}
          />
        </div>
      )}
    </div>
  );
}

// ── Grid style (responsive via media query emulation — Tailwind not used here) ──

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 12,
};

// NOTE: True responsive breakpoints are handled via a <style> tag injected once.
// This keeps the component pure without requiring Tailwind @apply.
if (typeof document !== 'undefined' && !document.getElementById('portfolio-grid-style')) {
  const style = document.createElement('style');
  style.id = 'portfolio-grid-style';
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    @keyframes attentionPulse {
      0%, 100% { transform: scale(1); opacity: 0.6; }
      50% { transform: scale(1.8); opacity: 0; }
    }
    @media (max-width: 1023px) {
      [data-portfolio-grid] { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
    }
    @media (max-width: 767px) {
      [data-portfolio-grid] { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
    }
  `;
  document.head.appendChild(style);
}
