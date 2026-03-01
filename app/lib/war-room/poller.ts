/**
 * War Room — Poller
 *
 * Polls /api/kernl/manifests every 5 seconds. Diffs against previous state
 * using JSON.stringify — only calls onUpdate when graph actually changes.
 * Returns a cleanup function (clearInterval).
 *
 * Sprint 2E — Dependency Graph UI
 */

import { buildGraph } from './graph-builder';
import type { WarRoomGraph } from './types';

const POLL_INTERVAL_MS = 5_000;

export function startWarRoomPolling(
  onUpdate: (graph: WarRoomGraph) => void,
  onError?: (err: unknown) => void,
): () => void {
  let previous: string = JSON.stringify({ nodes: [], edges: [] });
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    try {
      const next = await buildGraph();
      const serialised = JSON.stringify(next);
      if (serialised !== previous) {
        previous = serialised;
        onUpdate(next);
      }
    } catch (err) {
      onError?.(err);
    }
  };

  // First tick immediately so the graph populates on mount without waiting 5s
  void tick();

  const interval = setInterval(() => {
    void tick();
  }, POLL_INTERVAL_MS);

  return () => {
    stopped = true;
    clearInterval(interval);
  };
}
