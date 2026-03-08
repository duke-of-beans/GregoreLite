'use client';
import { apiFetch } from '@/lib/api-client';
/**
 * DecisionBrowser — S9-16
 * Full-page overlay. Three-column layout: filters | list | detail.
 * Triggered via command palette or Cmd+D.
 */


import { useState, useEffect, useCallback } from 'react';
import { DecisionFilter, type DecisionFilters } from './DecisionFilter';
import { DecisionRow } from './DecisionRow';
import { DecisionDetail } from './DecisionDetail';

interface DecisionItem {
  id: string;
  thread_id: string | null;
  category: string;
  title: string;
  rationale: string;
  alternatives: string[];
  impact: string | null;
  created_at: number;
  project_id: string | null;
  project_name: string | null;
}

interface ApiResponse {
  data: {
    items: DecisionItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    filters: {
      categories: string[];
      projects: Array<{ id: string; name: string }>;
    };
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenThread: (threadId: string) => void;
}

const emptyFilters: DecisionFilters = {
  project: '',
  category: '',
  impact: '',
  dateFrom: '',
  dateTo: '',
  search: '',
};

export function DecisionBrowser({ open, onClose, onOpenThread }: Props) {
  const [filters, setFilters] = useState<DecisionFilters>(emptyFilters);
  const [items, setItems] = useState<DecisionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableProjects, setAvailableProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [exporting, setExporting] = useState(false);

  const fetchDecisions = useCallback(async (f: DecisionFilters, p: number) => {
    const params = new URLSearchParams();
    if (f.project) params.set('project', f.project);
    if (f.category) params.set('category', f.category);
    if (f.impact) params.set('impact', f.impact);
    if (f.dateFrom) params.set('dateFrom', String(new Date(f.dateFrom).getTime()));
    if (f.dateTo) params.set('dateTo', String(new Date(f.dateTo).getTime() + 86_400_000));
    if (f.search) params.set('search', f.search);
    params.set('page', String(p));
    params.set('pageSize', '50');

    try {
      const res = await fetch(`/api/decisions?${params.toString()}`);
      if (!res.ok) return;
      const body = await res.json() as ApiResponse;
      setItems(body.data.items);
      setTotal(body.data.total);
      setTotalPages(body.data.totalPages);
      setAvailableCategories(body.data.filters.categories);
      setAvailableProjects(body.data.filters.projects);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (open) {
      void fetchDecisions(filters, page);
    }
  }, [open, filters, page, fetchDecisions]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await apiFetch('/api/decisions/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: filters.project || undefined,
          category: filters.category || undefined,
          impact: filters.impact || undefined,
        }),
      });
      if (res.ok) {
        const body = await res.json() as { data: { count: number } };
        alert(`Exported ${body.data.count} decisions to artifacts`);
      }
    } catch { /* silent */ }
    setExporting(false);
  }, [filters]);

  const selectedDecision = items.find((d) => d.id === selectedId) ?? null;

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      background: 'var(--deep-space)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid var(--shadow)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ice-white)', margin: 0 }}>
            📋 Decision Browser
          </h2>
          <span style={{ fontSize: 11, color: 'var(--frost)' }}>{total} decisions</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--shadow)',
              background: 'var(--elevated)',
              color: 'var(--cyan)',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            {exporting ? 'Exporting…' : 'Export to Markdown'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--shadow)',
              background: 'var(--elevated)',
              color: 'var(--frost)',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* Body: three-column layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Filters */}
        <div style={{
          width: 220,
          borderRight: '1px solid var(--shadow)',
          overflowY: 'auto',
        }}>
          <DecisionFilter
            filters={filters}
            onChange={(f) => { setFilters(f); setPage(1); setSelectedId(null); }}
            availableCategories={availableCategories}
            availableProjects={availableProjects}
          />
        </div>

        {/* Center: List */}
        <div style={{
          flex: 1,
          borderRight: '1px solid var(--shadow)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ flex: 1, padding: '4px 0' }}>
            {items.length === 0 ? (
              <div style={{ padding: 16, fontSize: 12, color: 'var(--frost)' }}>No decisions found</div>
            ) : (
              items.map((d) => (
                <DecisionRow
                  key={d.id}
                  decision={d}
                  selected={d.id === selectedId}
                  onClick={() => setSelectedId(d.id)}
                />
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 8,
              padding: '8px 0',
              borderTop: '1px solid var(--shadow)',
            }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{ padding: '4px 8px', fontSize: 11, borderRadius: 4, border: '1px solid var(--shadow)', background: 'var(--elevated)', color: 'var(--frost)', cursor: page <= 1 ? 'default' : 'pointer' }}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 11, color: 'var(--frost)', padding: '4px 0' }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{ padding: '4px 8px', fontSize: 11, borderRadius: 4, border: '1px solid var(--shadow)', background: 'var(--elevated)', color: 'var(--frost)', cursor: page >= totalPages ? 'default' : 'pointer' }}
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Right: Detail */}
        <div style={{ width: 360, overflowY: 'auto' }}>
          <DecisionDetail decision={selectedDecision} onOpenThread={onOpenThread} />
        </div>
      </div>
    </div>
  );
}
