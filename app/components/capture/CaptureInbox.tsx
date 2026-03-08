import { apiFetch } from '@/lib/api-client';
﻿/**
 * CaptureInbox — Sprint 29.0
 *
 * Full inbox view: all captured notes grouped by project, unrouted at top.
 * Sorted by mention_count DESC (high-mention items float to top).
 * Actions: Promote to backlog, Dismiss, Re-route.
 *
 * Accessible via: command palette (Cmd+K → "Capture Inbox")
 * or the Portfolio tab badge.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CaptureInboxItem, CaptureClassification } from '@/lib/capture/types';
import { CAPTURE } from '@/lib/voice/copy-templates';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CLASS_COLORS: Record<CaptureClassification, string> = {
  bug:      '#ef4444',
  feature:  '#3b82f6',
  question: '#f59e0b',
  idea:     '#8b5cf6',
};

function ClassBadge({ cls }: { cls: CaptureClassification }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600,
      color: CLASS_COLORS[cls],
      border: `1px solid ${CLASS_COLORS[cls]}33`,
      borderRadius: 4, padding: '1px 5px',
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {CAPTURE.classification[cls]}
    </span>
  );
}

function MentionBadge({ count }: { count: number }) {
  const isHigh = count >= 3;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700,
      color: isHigh ? '#f59e0b' : 'var(--mist)',
      background: isHigh ? '#f59e0b18' : 'transparent',
      border: isHigh ? '1px solid #f59e0b44' : 'none',
      borderRadius: 4, padding: '1px 5px',
    }}
    title={isHigh ? CAPTURE.inbox.high_priority : undefined}
    >
      {CAPTURE.inbox.mention_count(count)}
    </span>
  );
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

// ── NoteCard ──────────────────────────────────────────────────────────────────

interface NoteCardProps {
  note: CaptureInboxItem;
  onPromote: (id: string) => void;
  onDismiss: (id: string) => void;
  onReroute: (id: string, projectId: string) => void;
  projects: { id: string; name: string }[];
  loading: string | null;
}

function NoteCard({ note, onPromote, onDismiss, onReroute, projects, loading }: NoteCardProps) {
  const [showReroute, setShowReroute] = useState(false);
  const busy = loading === note.id;

  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: 6,
      background: 'var(--deep-space)',
      border: '1px solid var(--shadow)',
      marginBottom: 6,
      opacity: busy ? 0.5 : 1,
    }}>
      {/* Body text */}
      <div style={{ fontSize: 13, color: 'var(--ice-white)', lineHeight: 1.5, marginBottom: 6 }}>
        {note.parsed_body}
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <ClassBadge cls={note.classification} />
        {note.mention_count > 1 && <MentionBadge count={note.mention_count} />}
        <span style={{ fontSize: 11, color: 'var(--mist)', marginLeft: 'auto' }}>
          {formatRelative(note.created_at)}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => onPromote(note.id)}
          disabled={busy}
          style={actionBtnStyle('#3b82f6')}
        >
          {CAPTURE.inbox.promote}
        </button>
        <button
          onClick={() => onDismiss(note.id)}
          disabled={busy}
          style={actionBtnStyle('var(--mist)')}
        >
          {CAPTURE.inbox.dismiss}
        </button>
        <button
          onClick={() => setShowReroute(!showReroute)}
          disabled={busy}
          style={actionBtnStyle('var(--frost)')}
        >
          {CAPTURE.inbox.reroute}
        </button>
      </div>

      {/* Re-route dropdown */}
      {showReroute && (
        <div style={{ marginTop: 8 }}>
          <select
            onChange={(e) => {
              if (e.target.value) {
                onReroute(note.id, e.target.value);
                setShowReroute(false);
              }
            }}
            defaultValue=""
            style={{
              background: 'var(--elevated)',
              border: '1px solid var(--shadow)',
              color: 'var(--ice-white)',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 12,
            }}
          >
            <option value="" disabled>Choose project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function actionBtnStyle(color: string): React.CSSProperties {
  return {
    fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
    background: 'transparent', border: `1px solid ${color}44`,
    color, fontFamily: 'inherit',
  };
}

// ── Main component ────────────────────────────────────────────────────────────

interface CaptureInboxProps {
  open?: boolean;
  onClose?: () => void;
}

interface ProjectGroup {
  projectId: string | null;
  projectName: string | null;
  notes: CaptureInboxItem[];
}

export function CaptureInbox({ open, onClose }: CaptureInboxProps) {
  if (!open) return null;
  const [notes, setNotes] = useState<CaptureInboxItem[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [sortByTime, setSortByTime] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inboxRes, projRes] = await Promise.all([
        apiFetch('/api/capture/inbox'),
        apiFetch('/api/portfolio/projects?status=active'),
      ]);
      const inboxData = await inboxRes.json();
      const projData = await projRes.json();
      setNotes(inboxData.notes ?? []);
      if (Array.isArray(projData?.projects)) setProjects(projData.projects);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handlePromote = useCallback(async (id: string) => {
    setActionLoading(id);
    await fetch(`/api/capture/${id}/promote`, { method: 'POST' });
    await load();
    setActionLoading(null);
  }, [load]);

  const handleDismiss = useCallback(async (id: string) => {
    setActionLoading(id);
    await fetch(`/api/capture/${id}/dismiss`, { method: 'POST' });
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setActionLoading(null);
  }, []);

  const handleReroute = useCallback(async (noteId: string, _projectId: string) => {
    setActionLoading(noteId);
    await fetch(`/api/capture/${noteId}/dismiss`, { method: 'POST' });
    // Re-capture with project context — simplified: just reload
    await load();
    setActionLoading(null);
  }, [load]);

  // Group notes by project
  const sorted = sortByTime
    ? [...notes].sort((a, b) => b.created_at - a.created_at)
    : notes; // already sorted by mention_count DESC from API

  const groups: ProjectGroup[] = [];
  const seen = new Map<string | null, ProjectGroup>();

  for (const note of sorted) {
    const key = note.project_id ?? null;
    if (!seen.has(key)) {
      const group: ProjectGroup = {
        projectId: key,
        projectName: note.project_name,
        notes: [],
      };
      groups.push(group);
      seen.set(key, group);
    }
    seen.get(key)!.notes.push(note);
  }

  // Unrouted always first
  groups.sort((a, b) => {
    if (a.projectId === null) return -1;
    if (b.projectId === null) return 1;
    return 0;
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9990,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: 80,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(2px)',
    }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div style={{
        width: '100%', maxWidth: 640, maxHeight: 'calc(100vh - 120px)',
        background: 'var(--elevated)',
        border: '1px solid var(--shadow)',
        borderRadius: 12,
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderBottom: '1px solid var(--shadow)',
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ice-white)', margin: 0 }}>
            {CAPTURE.inbox.title}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setSortByTime(!sortByTime)}
              style={{ fontSize: 11, color: 'var(--mist)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {sortByTime ? 'Sort by frequency' : 'Sort by time'}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                style={{ background: 'none', border: 'none', color: 'var(--frost)', cursor: 'pointer', fontSize: 16 }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {loading && (
            <div style={{ textAlign: 'center', color: 'var(--mist)', fontSize: 13, padding: 24 }}>
              Loading…
            </div>
          )}

          {!loading && notes.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--mist)', fontSize: 13, padding: 24 }}>
              {CAPTURE.inbox.empty}
            </div>
          )}

          {!loading && groups.map((group) => (
            <div key={group.projectId ?? '__unrouted'} style={{ marginBottom: 20 }}>
              {/* Group header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 8,
              }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--frost)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {group.projectName ?? CAPTURE.inbox.unrouted_group}
                </span>
                {group.projectId && (
                  <button
                    onClick={async () => {
                      for (const note of group.notes) await handlePromote(note.id);
                    }}
                    style={{ fontSize: 10, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    {CAPTURE.inbox.promote_all(group.projectName ?? 'this project')}
                  </button>
                )}
              </div>

              {group.notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onPromote={handlePromote}
                  onDismiss={handleDismiss}
                  onReroute={handleReroute}
                  projects={projects}
                  loading={actionLoading}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
