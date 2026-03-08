'use client';
import { apiFetch } from '@/lib/api-client';

/**
 * QuickSpawnTemplates — Sprint 9-07
 *
 * Shows last 5 used templates (by use_count DESC) at the top of the
 * Workers tab. One-click spawns the template manifest directly.
 * "Open in Builder" link to pre-fill ManifestBuilder form instead.
 */

import { useCallback, useEffect, useState } from 'react';
import { useJobStore } from '@/lib/stores/job-store';
import { useThreadTabsStore } from '@/lib/stores/thread-tabs-store';
import { buildManifest } from '@/lib/agent-sdk/manifest';
import type { TaskType } from '@/lib/agent-sdk/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuickTemplate {
  id: string;
  name: string;
  task_type: TaskType;
  title: string;
  template_description: string;
  success_criteria: string[];
  project_path: string;
  use_count: number;
}

interface QuickSpawnTemplatesProps {
  onOpenInBuilder?: (template: QuickTemplate) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function QuickSpawnTemplates({ onOpenInBuilder }: QuickSpawnTemplatesProps) {
  const { spawnJob } = useJobStore();
  const activeTab = useThreadTabsStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const [templates, setTemplates] = useState<QuickTemplate[]>([]);
  const [spawning, setSpawning] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch('/api/templates')
      .then((res) => res.json())
      .then((data: { templates: QuickTemplate[] }) => {
        // Top 5 by use_count
        setTemplates(data.templates.slice(0, 5));
      })
      .catch(() => null);
  }, []);

  const handleQuickSpawn = useCallback(async (t: QuickTemplate) => {
    const threadId = activeTab?.kernlThreadId ?? 'default';
    const strategicThreadId = activeTab?.kernlThreadId ?? 'strategic';
    setSpawning(t.id);
    try {
      const manifest = buildManifest({
        threadId,
        strategicThreadId,
        taskType: t.task_type,
        title: t.title,
        description: t.template_description,
        successCriteria: t.success_criteria,
        projectPath: t.project_path,
        dependencies: [],
      });
      await spawnJob(manifest);
      // Increment use_count
      void fetch(`/api/templates?use=${encodeURIComponent(t.id)}`);
    } catch {
      /* best effort */
    } finally {
      setSpawning(null);
    }
  }, [activeTab, spawnJob]);

  if (templates.length === 0) return null;

  return (
    <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
      <div style={{
        fontSize: '9px', fontWeight: 600, color: 'var(--mist)',
        letterSpacing: '0.1em', marginBottom: '6px',
      }}>
        QUICK SPAWN
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {templates.map((t) => (
          <div
            key={t.id}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '10px', color: 'var(--frost)',
            }}
          >
            <button
              onClick={() => void handleQuickSpawn(t)}
              disabled={spawning === t.id}
              style={{
                background: 'none', border: '1px solid var(--border)',
                borderRadius: '3px', cursor: spawning === t.id ? 'not-allowed' : 'pointer',
                color: 'var(--accent)', fontSize: '10px', padding: '2px 6px',
                opacity: spawning === t.id ? 0.5 : 1,
              }}
              title={`Quick spawn: ${t.title}`}
            >
              ▶
            </button>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
              {t.name}
            </span>
            {onOpenInBuilder && (
              <button
                onClick={() => onOpenInBuilder(t)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--mist)', fontSize: '9px', textDecoration: 'underline',
                  padding: 0, flexShrink: 0,
                }}
              >
                Open in Builder
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
