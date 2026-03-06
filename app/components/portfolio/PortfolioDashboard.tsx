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
import { RefreshCw, FolderKanban } from 'lucide-react';
import { PORTFOLIO } from '@/lib/voice/copy-templates';
import { ProjectCard } from './ProjectCard';
import { ProjectDetail } from './ProjectDetail';
import type { ProjectCard as ProjectCardData } from '@/lib/portfolio/types';

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

// ── Add Project input ─────────────────────────────────────────────────────────

interface AddProjectRowProps {
  onRegistered: () => void;
}

function AddProjectRow({ onRegistered }: AddProjectRowProps) {
  const [value, setValue] = useState('');
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleRegister = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setRegistering(true);
    setMessage(null);
    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: trimmed }),
      });
      const body = await res.json() as { success: boolean; data?: { id: string; card: ProjectCardData | null }; error?: string };
      if (body.success) {
        const name = body.data?.card?.name ?? trimmed.split(/[\\/]/).pop() ?? 'Project';
        setMessage(PORTFOLIO.addProject.successMessage(name));
        setValue('');
        onRegistered();
      } else {
        setMessage(PORTFOLIO.addProject.errorMessage(body.error ?? 'Unknown error'));
      }
    } catch (err) {
      setMessage(PORTFOLIO.addProject.errorMessage(err instanceof Error ? err.message : 'Network error'));
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleRegister(); }}
          placeholder={PORTFOLIO.addProject.placeholder}
          disabled={registering}
          style={{
            flex: 1,
            background: 'var(--surface)',
            border: '1px solid var(--shadow)',
            borderRadius: 6,
            padding: '7px 12px',
            fontSize: 12,
            color: 'var(--frost)',
            outline: 'none',
          }}
        />
        <button
          onClick={() => { void handleRegister(); }}
          disabled={registering || !value.trim()}
          style={{
            background: 'rgba(0, 212, 232, 0.08)',
            border: '1px solid var(--cyan)',
            borderRadius: 6,
            padding: '7px 14px',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--cyan)',
            cursor: registering || !value.trim() ? 'not-allowed' : 'pointer',
            opacity: registering || !value.trim() ? 0.5 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {registering ? PORTFOLIO.addProject.registering : PORTFOLIO.addProject.registerButton}
        </button>
      </div>
      {message && (
        <p style={{ fontSize: 11, color: 'var(--mist)', margin: 0 }}>{message}</p>
      )}
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export function PortfolioDashboard() {
  const [projects, setProjects] = useState<ProjectCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailStatusFull, setDetailStatusFull] = useState<string | null>(null);
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
    pollRef.current = setInterval(() => { void fetchProjects(true); }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchProjects]);

  const selectedProject = projects.find((p) => p.id === selectedId) ?? null;

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

        {/* Add project row */}
        <div style={{ marginBottom: 20, maxWidth: 600 }}>
          <AddProjectRow onRegistered={() => { void fetchProjects(true); }} />
        </div>

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
              <ProjectCard
                key={project.id}
                project={project}
                onSelect={(id) => { void handleSelect(id); }}
              />
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
    @media (max-width: 1023px) {
      [data-portfolio-grid] { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
    }
    @media (max-width: 767px) {
      [data-portfolio-grid] { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
    }
  `;
  document.head.appendChild(style);
}
