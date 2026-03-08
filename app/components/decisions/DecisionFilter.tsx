'use client';
/**
 * DecisionFilter — S9-16
 * Left sidebar: project dropdown, category multi-select, impact checkboxes, date range, search.
 */


import { useState, useCallback } from 'react';

export interface DecisionFilters {
  project: string;
  category: string;
  impact: string;
  dateFrom: string;
  dateTo: string;
  search: string;
}

interface Props {
  filters: DecisionFilters;
  onChange: (filters: DecisionFilters) => void;
  availableCategories: string[];
  availableProjects: Array<{ id: string; name: string }>;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid var(--shadow)',
  background: 'var(--elevated)',
  color: 'var(--ice-white)',
  fontSize: 12,
};

export function DecisionFilter({ filters, onChange, availableCategories, availableProjects }: Props) {
  const [localSearch, setLocalSearch] = useState(filters.search);

  const update = useCallback((patch: Partial<DecisionFilters>) => {
    onChange({ ...filters, ...patch });
  }, [filters, onChange]);

  const handleSearchSubmit = useCallback(() => {
    update({ search: localSearch });
  }, [localSearch, update]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12, minWidth: 200 }}>
      <h4 style={{ fontSize: 11, fontWeight: 600, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
        Filters
      </h4>

      {/* Search */}
      <div>
        <label style={{ fontSize: 10, color: 'var(--frost)', display: 'block', marginBottom: 4 }}>Search</label>
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearchSubmit(); }}
          placeholder="Full-text search…"
          style={inputStyle}
        />
      </div>

      {/* Project */}
      <div>
        <label style={{ fontSize: 10, color: 'var(--frost)', display: 'block', marginBottom: 4 }}>Project</label>
        <select value={filters.project} onChange={(e) => update({ project: e.target.value })} style={inputStyle}>
          <option value="">All projects</option>
          {availableProjects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Category */}
      <div>
        <label style={{ fontSize: 10, color: 'var(--frost)', display: 'block', marginBottom: 4 }}>Category</label>
        <select value={filters.category} onChange={(e) => update({ category: e.target.value })} style={inputStyle}>
          <option value="">All categories</option>
          {availableCategories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Impact */}
      <div>
        <label style={{ fontSize: 10, color: 'var(--frost)', display: 'block', marginBottom: 4 }}>Impact</label>
        <select value={filters.impact} onChange={(e) => update({ impact: e.target.value })} style={inputStyle}>
          <option value="">All</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Date range */}
      <div>
        <label style={{ fontSize: 10, color: 'var(--frost)', display: 'block', marginBottom: 4 }}>From</label>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => update({ dateFrom: e.target.value })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={{ fontSize: 10, color: 'var(--frost)', display: 'block', marginBottom: 4 }}>To</label>
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => update({ dateTo: e.target.value })}
          style={inputStyle}
        />
      </div>
    </div>
  );
}
