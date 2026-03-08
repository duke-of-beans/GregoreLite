'use client';

/**
 * ImportSection — Memory Sources settings panel.
 * Sprint 33.0 / EPIC-81
 *
 * Drag-drop (or click-to-browse) zone for conversation export files.
 * Polls /api/import/progress/[sourceId] every 2 s while an import is running.
 * Lists all imported sources with conversation/chunk counts and a delete button.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { IMPORT } from '@/lib/voice/copy-templates';
import type { ImportSourceRow } from '@/api/import/sources/route';
import type { ImportProgress } from '@/lib/import/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActiveImport {
  sourceId: string;
  progress: ImportProgress;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function platformLabel(sourceType: string): string {
  return IMPORT.platform_generic; // display_name carries the filename
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ImportSection() {
  const [isDragging, setIsDragging]     = useState(false);
  const [isUploading, setIsUploading]   = useState(false);
  const [uploadError, setUploadError]   = useState<string | null>(null);
  const [activeImport, setActiveImport] = useState<ActiveImport | null>(null);
  const [sources, setSources]           = useState<ImportSourceRow[]>([]);
  const [deletingId, setDeletingId]     = useState<string | null>(null);

  const fileInputRef  = useRef<HTMLInputElement>(null);
  const pollTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load sources on mount ──────────────────────────────────────────────────
  const loadSources = useCallback(async () => {
    try {
      const res = await fetch('/api/import/sources');
      if (res.ok) setSources(await res.json() as ImportSourceRow[]);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { void loadSources(); }, [loadSources]);

  // ── Progress polling ───────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback((sourceId: string) => {
    stopPolling();
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/import/progress/${sourceId}`);
        if (!res.ok) return;
        const progress = await res.json() as ImportProgress;
        setActiveImport({ sourceId, progress });
        if (progress.status !== 'running') {
          stopPolling();
          void loadSources();
        }
      } catch { stopPolling(); }
    }, 2000);
  }, [stopPolling, loadSources]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── File processing ────────────────────────────────────────────────────────
  const processFile = useCallback(async (file: File) => {
    setUploadError(null);
    setIsUploading(true);
    setActiveImport(null);

    try {
      const form = new FormData();
      form.append('file', file);

      const res = await fetch('/api/import/upload', { method: 'POST', body: form });
      const body = await res.json() as { sourceId?: string; conversationCount?: number; error?: string };

      if (!res.ok || !body.sourceId) {
        setUploadError(body.error ?? 'Upload failed');
        return;
      }

      const initialProgress: ImportProgress = {
        total: body.conversationCount ?? 0,
        processed: 0,
        skipped: 0,
        chunks_written: 0,
        status: 'running',
      };
      setActiveImport({ sourceId: body.sourceId, progress: initialProgress });
      startPolling(body.sourceId);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [startPolling]);

  // ── Drag handlers ──────────────────────────────────────────────────────────
  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = ()                   => setIsDragging(false);
  const onDrop      = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void processFile(file);
  };
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
    e.target.value = '';
  };

  // ── Delete source ──────────────────────────────────────────────────────────
  const deleteSource = async (id: string) => {
    if (!confirm(IMPORT.source_delete_confirm)) return;
    setDeletingId(id);
    try {
      await fetch(`/api/import/sources/${id}`, { method: 'DELETE' });
      await loadSources();
    } finally {
      setDeletingId(null);
    }
  };

  // ── Progress label ─────────────────────────────────────────────────────────
  function progressLabel(p: ImportProgress): string {
    if (p.status === 'error')    return IMPORT.progress_error(p.error ?? 'unknown error');
    if (p.status === 'complete') return IMPORT.progress_complete(p.processed, p.chunks_written);
    return IMPORT.progress_running(p.processed, p.total);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--frost)', marginBottom: 4 }}>
        {IMPORT.section_title}
      </h3>
      <p style={{ fontSize: 12, color: 'var(--mist)', marginBottom: 12, lineHeight: 1.5 }}>
        {IMPORT.section_description}
      </p>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          border: `1px dashed ${isDragging ? 'var(--cyan)' : 'rgba(255,255,255,0.15)'}`,
          borderRadius: 8,
          padding: '20px 16px',
          textAlign: 'center',
          cursor: isUploading ? 'wait' : 'pointer',
          background: isDragging ? 'rgba(0,212,232,0.04)' : 'transparent',
          transition: 'border-color 0.15s, background 0.15s',
          marginBottom: 12,
          userSelect: 'none',
        }}
      >
        <div style={{ fontSize: 12, color: isDragging ? 'var(--cyan)' : 'var(--mist)', marginBottom: 4 }}>
          {isUploading
            ? IMPORT.dropzone_processing
            : isDragging
              ? IMPORT.dropzone_dragging
              : IMPORT.dropzone_idle}
        </div>
        {!isDragging && !isUploading && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
            {IMPORT.dropzone_hint}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,.json"
        style={{ display: 'none' }}
        onChange={onFileChange}
      />

      {/* Upload error */}
      {uploadError && (
        <p style={{ fontSize: 12, color: 'var(--red-400, #f87171)', marginBottom: 8 }}>
          {uploadError}
        </p>
      )}

      {/* Active import progress */}
      {activeImport && (
        <div style={{
          fontSize: 12,
          color: activeImport.progress.status === 'error' ? 'var(--red-400, #f87171)'
               : activeImport.progress.status === 'complete' ? 'var(--green-400)'
               : 'var(--cyan)',
          marginBottom: 10,
          lineHeight: 1.5,
        }}>
          {progressLabel(activeImport.progress)}
          {activeImport.progress.skipped > 0 && (
            <span style={{ color: 'var(--mist)', marginLeft: 8 }}>
              {IMPORT.progress_skipped(activeImport.progress.skipped)}
            </span>
          )}
        </div>
      )}

      {/* Sources list */}
      {sources.length === 0 ? (
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
          {IMPORT.sources_empty}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {sources.map((src) => (
            <li
              key={src.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--frost)', marginBottom: 2,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {src.display_name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--mist)' }}>
                  {IMPORT.source_conversations(src.conversation_count)}
                  {' · '}
                  {IMPORT.source_chunks(src.chunk_count)}
                  {' · '}
                  {formatDate(src.created_at)}
                </div>
              </div>

              <button
                onClick={() => void deleteSource(src.id)}
                disabled={deletingId === src.id}
                title={IMPORT.source_delete}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: deletingId === src.id ? 'wait' : 'pointer',
                  color: 'rgba(255,255,255,0.3)',
                  fontSize: 16,
                  padding: '0 4px',
                  flexShrink: 0,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
