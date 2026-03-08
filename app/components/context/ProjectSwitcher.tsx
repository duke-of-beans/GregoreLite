'use client';
import { apiFetch } from '@/lib/api-client';
/**
 * ProjectSwitcher — S9-19
 * Popover listing all active projects. Click to switch active project.
 * Triggered from ProjectSection on project name click.
 */


import { useState, useEffect, useRef, useCallback } from 'react';

interface ProjectItem {
  id: string;
  name: string;
  path: string | null;
  status: string;
}

interface Props {
  currentProjectId: string;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onSwitch: (projectId: string) => void;
}

export function ProjectSwitcher({ currentProjectId, anchorEl, onClose, onSwitch }: Props) {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch('/api/projects');
        if (res.ok) {
          const body = await res.json() as { data: ProjectItem[] };
          setProjects(body.data ?? []);
        }
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSwitch = useCallback(async (projectId: string) => {
    try {
      await apiFetch('/api/projects/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      onSwitch(projectId);
    } catch {
      console.warn('[project-switcher] Switch failed');
    }
    onClose();
  }, [onSwitch, onClose]);

  // Position below anchor
  const rect = anchorEl?.getBoundingClientRect();
  const top = rect ? rect.bottom + 4 : 0;
  const left = rect ? rect.left : 0;

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top,
        left,
        zIndex: 2000,
        minWidth: 240,
        maxWidth: 360,
        maxHeight: 320,
        overflowY: 'auto',
        background: 'var(--elevated)',
        border: '1px solid var(--shadow)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        padding: '4px 0',
      }}
    >
      <div style={{ padding: '8px 12px', fontSize: 10, color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Switch Project
      </div>

      {loading ? (
        <div style={{ padding: '12px', fontSize: 12, color: 'var(--frost)' }}>Loading…</div>
      ) : projects.length === 0 ? (
        <div style={{ padding: '12px', fontSize: 12, color: 'var(--frost)' }}>No projects</div>
      ) : (
        projects.map((p) => {
          const isCurrent = p.id === currentProjectId;
          return (
            <button
              key={p.id}
              onClick={() => { if (!isCurrent) void handleSwitch(p.id); }}
              disabled={isCurrent}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '8px 12px',
                background: isCurrent ? 'var(--surface)' : 'transparent',
                border: 'none',
                cursor: isCurrent ? 'default' : 'pointer',
                textAlign: 'left',
                color: isCurrent ? 'var(--cyan)' : 'var(--ice-white)',
                fontSize: 13,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; }}
              onMouseLeave={(e) => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: isCurrent ? 'var(--cyan)' : 'var(--mist)',
                flexShrink: 0,
              }} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontWeight: isCurrent ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                </div>
                {p.path && (
                  <div style={{ fontSize: 10, color: 'var(--mist)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.path}
                  </div>
                )}
              </div>
              {isCurrent && (
                <span style={{ fontSize: 10, color: 'var(--cyan)', flexShrink: 0 }}>Active</span>
              )}
            </button>
          );
        })
      )}
    </div>
  );
}