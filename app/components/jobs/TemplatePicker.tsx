import { apiFetch } from '@/lib/api-client';
'use client';

/**
 * TemplatePicker — Sprint 9-07
 *
 * Template list with search, grouped by task_type.
 * Used inside TemplatePickerPanel.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TaskType } from '@/lib/agent-sdk/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TemplateItem {
  id: string;
  name: string;
  description: string | null;
  task_type: TaskType;
  title: string;
  template_description: string;
  success_criteria: string[];
  project_path: string;
  use_count: number;
}

interface TemplatePickerProps {
  onSelect: (template: TemplateItem) => void;
  onDelete: (id: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TemplatePicker({ onSelect, onDelete }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await apiFetch('/api/templates');
      if (res.ok) {
        const data = (await res.json()) as { templates: TemplateItem[] };
        setTemplates(data.templates);
      }
    } catch { /* best effort */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchTemplates(); }, [fetchTemplates]);

  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.task_type.toLowerCase().includes(q)
    );
  }, [templates, search]);

  // Group by task_type
  const grouped = useMemo(() => {
    const map = new Map<string, TemplateItem[]>();
    for (const t of filtered) {
      const group = map.get(t.task_type) ?? [];
      group.push(t);
      map.set(t.task_type, group);
    }
    return map;
  }, [filtered]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        onDelete(id);
      }
    } catch { /* best effort */ }
  }, [onDelete]);

  if (loading) {
    return <p style={{ fontSize: '11px', color: 'var(--mist)', padding: '16px' }}>Loading…</p>;
  }

  if (templates.length === 0) {
    return (
      <div style={{ padding: '16px', textAlign: 'center' }}>
        <p style={{ fontSize: '11px', color: 'var(--mist)', fontStyle: 'italic' }}>
          No saved templates yet
        </p>
        <p style={{ fontSize: '10px', color: 'var(--mist)', marginTop: '4px' }}>
          Use &quot;Save as Template&quot; in ManifestBuilder
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates…"
          style={{
            width: '100%',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '3px',
            color: 'var(--frost)',
            fontSize: '11px',
            padding: '4px 6px',
            outline: 'none',
            boxSizing: 'border-box' as const,
          }}
        />
      </div>

      {/* Grouped list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px' }}>
        {Array.from(grouped.entries()).map(([taskType, items]) => (
          <div key={taskType} style={{ marginBottom: '10px' }}>
            <div style={{
              fontSize: '9px', fontWeight: 600, color: 'var(--mist)',
              letterSpacing: '0.1em', marginBottom: '4px', textTransform: 'uppercase' as const,
            }}>
              {taskType}
            </div>
            {items.map((t) => (
              <div
                key={t.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 8px', borderRadius: '4px', marginBottom: '2px',
                  cursor: 'pointer', fontSize: '11px', color: 'var(--frost)',
                  transition: 'background 0.1s',
                }}
                onClick={() => onSelect(t)}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  {t.name}
                </span>
                <span style={{ fontSize: '9px', color: 'var(--mist)', flexShrink: 0 }}>
                  ×{t.use_count}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); void handleDelete(t.id); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--mist)', fontSize: '10px', padding: '0 2px', flexShrink: 0,
                  }}
                  title="Delete template"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
