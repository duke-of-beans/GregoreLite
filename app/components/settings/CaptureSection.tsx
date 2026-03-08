import { apiFetch } from '@/lib/api-client';
﻿/**
 * CaptureSection — Sprint 29.0
 *
 * Settings panel section: "Quick Capture".
 * Shows hotkey, smart merge toggle, default project, inbox badge toggle.
 * Follows the same inline-style pattern as RecallSection.tsx.
 */

'use client';

import { useState, useEffect } from 'react';
import { CAPTURE } from '@/lib/voice/copy-templates';

interface CaptureSettings {
  smartMerge: boolean;
  defaultProjectId: string | null;
  showInboxBadge: boolean;
}

export function CaptureSection() {
  const [settings, setSettings] = useState<CaptureSettings>({
    smartMerge: true,
    defaultProjectId: null,
    showInboxBadge: true,
  });
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    // Load from kernl_settings
    apiFetch('/api/settings?keys=capture_smart_merge,capture_default_project,capture_inbox_badge')
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        setSettings({
          smartMerge: data.capture_smart_merge !== 'false',
          defaultProjectId: data.capture_default_project ?? null,
          showInboxBadge: data.capture_inbox_badge !== 'false',
        });
      })
      .catch(() => null);

    apiFetch('/api/portfolio/projects?status=active')
      .then((r) => r.json())
      .then((data: { projects?: { id: string; name: string }[] }) => {
        if (Array.isArray(data?.projects)) setProjects(data.projects);
      })
      .catch(() => null);
  }, []);

  const save = async (patch: Partial<CaptureSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await apiFetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        capture_smart_merge: String(next.smartMerge),
        capture_default_project: next.defaultProjectId ?? '',
        capture_inbox_badge: String(next.showInboxBadge),
      }),
    }).catch(() => null);
  };

  return (
    <section>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ice-white)', marginBottom: 4 }}>
        {CAPTURE.settings.title}
      </h3>
      <p style={{ fontSize: 12, color: 'var(--mist)', marginBottom: 16, lineHeight: 1.5 }}>
        {CAPTURE.settings.description}
      </p>

      {/* Hotkey (read-only) */}
      <div style={rowStyle}>
        <span style={labelStyle}>{CAPTURE.settings.hotkey_label}</span>
        <kbd style={kbdStyle}>{CAPTURE.settings.hotkey_value}</kbd>
      </div>

      {/* Smart merge toggle */}
      <div style={rowStyle}>
        <span style={labelStyle}>{CAPTURE.settings.dedup_label}</span>
        <button
          onClick={() => void save({ smartMerge: !settings.smartMerge })}
          style={toggleStyle(settings.smartMerge)}
          aria-pressed={settings.smartMerge}
        >
          {settings.smartMerge ? 'On' : 'Off'}
        </button>
      </div>

      {/* Inbox badge toggle */}
      <div style={rowStyle}>
        <span style={labelStyle}>{CAPTURE.settings.inbox_badge_label}</span>
        <button
          onClick={() => void save({ showInboxBadge: !settings.showInboxBadge })}
          style={toggleStyle(settings.showInboxBadge)}
          aria-pressed={settings.showInboxBadge}
        >
          {settings.showInboxBadge ? 'On' : 'Off'}
        </button>
      </div>

      {/* Default project */}
      <div style={{ ...rowStyle, alignItems: 'flex-start', flexDirection: 'column', gap: 6 }}>
        <span style={labelStyle}>{CAPTURE.settings.default_project_label}</span>
        <select
          value={settings.defaultProjectId ?? ''}
          onChange={(e) => void save({ defaultProjectId: e.target.value || null })}
          style={{
            background: 'var(--deep-space)',
            border: '1px solid var(--shadow)',
            color: 'var(--ice-white)',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 12,
            width: '100%',
          }}
        >
          <option value="">{CAPTURE.settings.default_project_none}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
    </section>
  );
}

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  marginBottom: 12,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12, color: 'var(--frost)',
};

const kbdStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--mist)',
  border: '1px solid var(--shadow)', borderRadius: 4,
  padding: '2px 8px', background: 'var(--deep-space)',
};

function toggleStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 11, padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
    background: active ? '#3b82f620' : 'transparent',
    border: `1px solid ${active ? '#3b82f6' : 'var(--shadow)'}`,
    color: active ? '#3b82f6' : 'var(--mist)',
    fontFamily: 'inherit',
  };
}
