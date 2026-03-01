/**
 * WarRoom — main War Room view.
 * Polls KERNL for manifests, renders the dependency graph, and shows a
 * detail sidebar when a node is clicked. Accessible via tab or Cmd+W.
 * Sprint 2E — Dependency Graph UI
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { startWarRoomPolling } from '@/lib/war-room/poller';
import type { WarRoomGraph } from '@/lib/war-room/types';
import { DependencyGraph } from './DependencyGraph';
import { ManifestDetail } from './ManifestDetail';
import { WarRoomEmpty } from './WarRoomEmpty';

export function WarRoom() {
  const [graph, setGraph] = useState<WarRoomGraph>({ nodes: [], edges: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pollError, setPollError] = useState<string | null>(null);

  const handleUpdate = useCallback((next: WarRoomGraph) => {
    setGraph(next);
    setLoading(false);
    setPollError(null);
  }, []);

  const handleError = useCallback((err: unknown) => {
    const msg = err instanceof Error ? err.message : 'Poll failed';
    setPollError(msg);
    setLoading(false);
  }, []);

  useEffect(() => {
    const stop = startWarRoomPolling(handleUpdate, handleError);
    return stop;
  }, [handleUpdate, handleError]);

  const selectedNode = graph.nodes.find((n) => n.id === selectedId) ?? null;
  const isEmpty = !loading && graph.nodes.length === 0;

  return (
    <div className="flex h-full w-full overflow-hidden bg-[var(--deep-space)]">
      {/* Main graph area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-[var(--shadow)] bg-[var(--elevated)] px-4 py-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--ice-white)]">War Room</span>
            {graph.nodes.length > 0 && (
              <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-xs text-[var(--frost)]">
                {graph.nodes.length} job{graph.nodes.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {pollError && (
            <span className="text-xs text-[var(--error)]" title={pollError}>
              ⚠ Poll error
            </span>
          )}

          <span className="text-xs text-[var(--mist)]">
            Live · 5s
          </span>
        </div>

        {/* Graph canvas or states */}
        <div className="flex-1 overflow-hidden p-4">
          {loading && (
            <div className="flex h-full items-center justify-center text-sm text-[var(--ghost-text)]">
              Loading…
            </div>
          )}
          {!loading && isEmpty && <WarRoomEmpty />}
          {!loading && !isEmpty && (
            <DependencyGraph
              graph={graph}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </div>
      </div>

      {/* Detail sidebar */}
      {selectedNode && (
        <ManifestDetail
          node={selectedNode}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
