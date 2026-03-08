'use client';
/**
 * LiveOutputPanel — Sprint 7F
 *
 * Opt-in raw output viewer. Polls /api/agent-sdk/jobs/:id/output every 2s
 * while the session is active. Auto-scrolls to bottom unless David has
 * manually scrolled up (standard scroll-lock pattern).
 *
 * Shows last 500 lines from ring buffer (active) or temp log file (finished).
 */


import { useEffect, useRef, useState, useCallback } from 'react';

interface LiveOutputPanelProps {
  manifestId: string;
  isActive: boolean; // whether the session is still running
}

export function LiveOutputPanel({ manifestId, isActive }: LiveOutputPanelProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [source, setSource] = useState<'ring_buffer' | 'log_file' | 'none'>('none');
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOutput = useCallback(async () => {
    try {
      const res = await fetch(`/api/agent-sdk/jobs/${manifestId}/output`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { data: { lines: string[]; source: string } };
      setLines(json.data.lines);
      setSource(json.data.source as 'ring_buffer' | 'log_file' | 'none');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch output');
    }
  }, [manifestId]);

  // Auto-scroll unless user has scrolled up
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || userScrolledUp.current) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);

  // Start polling; stop when session is no longer active
  useEffect(() => {
    fetchOutput();
    if (isActive) {
      intervalRef.current = setInterval(fetchOutput, 2000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchOutput, isActive]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    userScrolledUp.current = !atBottom;
  }

  const sourceLabel = source === 'ring_buffer'
    ? 'live · ring buffer'
    : source === 'log_file'
    ? 'from log file'
    : 'no output';

  return (
    <div
      style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--bg)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── Header bar ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 12px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{ fontSize: '9px', color: 'var(--mist)', letterSpacing: '0.08em' }}>
          OUTPUT · {lines.length} lines · {sourceLabel}
        </span>
        {isActive && (
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: '#22c55e',
              animation: 'pulse 1.5s ease-in-out infinite',
              display: 'inline-block',
            }}
          />
        )}
      </div>

      {error && (
        <div style={{ padding: '4px 12px', fontSize: '10px', color: '#ef4444' }}>
          {error}
        </div>
      )}

      {/* ── Scrollable log area ─────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          maxHeight: '200px',
          overflowY: 'auto',
          padding: '8px 12px',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '10px',
          lineHeight: '1.5',
        }}
      >
        {lines.length === 0 ? (
          <span style={{ color: 'var(--mist)', fontStyle: 'italic' }}>No output yet…</span>
        ) : (
          lines.map((line, i) => (
            <div
              key={i}
              style={{
                color: line.startsWith('[error]') ? '#ef4444'
                  : line.startsWith('[warn]')  ? '#f59e0b'
                  : 'var(--mist)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
