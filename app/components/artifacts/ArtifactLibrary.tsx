/**
 * ArtifactLibrary — S9-17
 * Right-side drawer for browsing all artifacts across sessions.
 * Filters: project, type, language, date. Search by title.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArtifactLibraryRow } from './ArtifactLibraryRow';

interface ArtifactItem {
  id: string;
  thread_id: string | null;
  project_id: string | null;
  type: string;
  title: string;
  language: string | null;
  file_path: string | null;
  created_at: number;
  project_name: string | null;
  contentPreview: string;
}

interface ApiResponse {
  data: {
    items: ArtifactItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    filters: {
      types: string[];
      languages: string[];
      projects: Array<{ id: string; name: string }>;
    };
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectArtifact: (artifactId: string) => void;
}

const selectStyle: React.CSSProperties = {
  padding: '4px 6px',
  borderRadius: 4,
  border: '1px solid var(--shadow)',
  background: 'var(--elevated)',
  color: 'var(--ice-white)',
  fontSize: 11,
  flex: 1,
};

export function ArtifactLibrary({ open, onClose, onSelectArtifact }: Props) {
  const [items, setItems] = useState<ArtifactItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filter state
  const [search, setSearch] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');

  // Available filter options
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [availableProjects, setAvailableProjects] = useState<Array<{ id: string; name: string }>>([]);

  const fetchArtifacts = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterProject) params.set('project', filterProject);
    if (filterType) params.set('type', filterType);
    if (filterLanguage) params.set('language', filterLanguage);
    if (search) params.set('search', search);
    params.set('page', String(page));
    params.set('pageSize', '50');

    try {
      const res = await fetch(`/api/artifacts?${params.toString()}`);
      if (!res.ok) return;
      const body = await res.json() as ApiResponse;
      setItems(body.data.items);
      setTotal(body.data.total);
      setTotalPages(body.data.totalPages);
      setAvailableTypes(body.data.filters.types);
      setAvailableLanguages(body.data.filters.languages);
      setAvailableProjects(body.data.filters.projects);
    } catch { /* silent */ }
  }, [filterProject, filterType, filterLanguage, search, page]);

  useEffect(() => {
    if (open) void fetchArtifacts();
  }, [open, fetchArtifacts]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      width: 440,
      zIndex: 900,
      background: 'var(--deep-space)',
      borderLeft: '1px solid var(--shadow)',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '-4px 0 16px rgba(0,0,0,0.4)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid var(--shadow)',
      }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ice-white)', margin: 0 }}>
            📦 Artifact Library
          </h3>
          <span style={{ fontSize: 10, color: 'var(--frost)' }}>{total} artifacts</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--frost)', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>

      {/* Filters */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--shadow)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by title…"
          style={{ ...selectStyle, flex: 'none', width: '100%' }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={filterProject} onChange={(e) => { setFilterProject(e.target.value); setPage(1); }} style={selectStyle}>
            <option value="">All projects</option>
            {availableProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }} style={selectStyle}>
            <option value="">All types</option>
            {availableTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterLanguage} onChange={(e) => { setFilterLanguage(e.target.value); setPage(1); }} style={selectStyle}>
            <option value="">All langs</option>
            {availableLanguages.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {items.length === 0 ? (
          <div style={{ padding: 16, fontSize: 12, color: 'var(--frost)' }}>No artifacts found</div>
        ) : items.map((a) => (
          <ArtifactLibraryRow
            key={a.id}
            artifact={a}
            selected={a.id === selectedId}
            onClick={() => {
              setSelectedId(a.id);
              onSelectArtifact(a.id);
            }}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid var(--shadow)' }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{ padding: '4px 8px', fontSize: 11, borderRadius: 4, border: '1px solid var(--shadow)', background: 'var(--elevated)', color: 'var(--frost)', cursor: page <= 1 ? 'default' : 'pointer' }}
          >← Prev</button>
          <span style={{ fontSize: 11, color: 'var(--frost)', padding: '4px 0' }}>{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{ padding: '4px 8px', fontSize: 11, borderRadius: 4, border: '1px solid var(--shadow)', background: 'var(--elevated)', color: 'var(--frost)', cursor: page >= totalPages ? 'default' : 'pointer' }}
          >Next →</button>
        </div>
      )}
    </div>
  );
}