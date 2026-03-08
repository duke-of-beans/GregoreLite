'use client';
import { apiFetch } from '@/lib/api-client';
/**
 * ManifestDetail — sidebar panel shown when a node is clicked.
 * Displays manifest metadata, cost, timestamps, and a Restart button
 * for failed/interrupted jobs.
 * Sprint 2E — Dependency Graph UI
 */


import { useState } from 'react';
import type { GraphNode, NodeStatus } from '@/lib/war-room/types';

const STATUS_COLOR: Record<NodeStatus, string> = {
  pending:     'var(--shadow)',
  running:     'var(--cyan)',
  complete:    'var(--success)',
  partial:     'var(--warning)',
  failed:      'var(--error)',
  interrupted: 'var(--muted)',
};

export interface ManifestDetailProps {
  node: GraphNode;
  onClose: () => void;
}

export function ManifestDetail({ node, onClose }: ManifestDetailProps) {
  const [restarting, setRestarting] = useState(false);
  const [restartError, setRestartError] = useState<string | null>(null);

  const canRestart = node.status === 'failed' || node.status === 'interrupted';
  const color = STATUS_COLOR[node.status];

  const handleRestart = async () => {
    setRestarting(true);
    setRestartError(null);
    try {
      // Fetch original manifest row then POST a new spawn
      const res = await fetch(`/api/kernl/manifests/${node.id}`);
      if (!res.ok) throw new Error(`Failed to fetch manifest: ${res.status}`);
      const original = await res.json();

      const spawnRes = await apiFetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...original, manifest_id: undefined }),
      });
      if (!spawnRes.ok) throw new Error(`Spawn failed: ${spawnRes.status}`);
    } catch (err) {
      setRestartError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRestarting(false);
    }
  };

  return (
    <div className="flex h-full w-72 flex-shrink-0 flex-col border-l border-[var(--shadow)] bg-[var(--elevated)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--shadow)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--ice-white)] truncate">{node.title}</h3>
        <button
          onClick={onClose}
          className="ml-2 flex-shrink-0 text-[var(--mist)] hover:text-[var(--ice-white)] transition-colors"
          aria-label="Close detail panel"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 text-sm">
        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full flex-shrink-0"
            style={{ background: color }}
          />
          <span className="uppercase tracking-wide text-xs font-medium" style={{ color }}>
            {node.status}
          </span>
        </div>

        {/* Task type */}
        <div>
          <span className="text-[var(--frost)] text-xs uppercase tracking-wide">Type</span>
          <p className="mt-0.5 text-[var(--ice-white)]">{node.taskType}</p>
        </div>

        {/* Cost */}
        {node.costUsd !== undefined && (
          <div>
            <span className="text-[var(--frost)] text-xs uppercase tracking-wide">Cost</span>
            <p className="mt-0.5 text-[var(--ice-white)]">
              ${node.costUsd.toFixed(4)}
            </p>
          </div>
        )}

        {/* Tokens */}
        {node.tokensUsed !== undefined && node.tokensUsed > 0 && (
          <div>
            <span className="text-[var(--frost)] text-xs uppercase tracking-wide">Tokens</span>
            <p className="mt-0.5 text-[var(--ice-white)]">{node.tokensUsed.toLocaleString()}</p>
          </div>
        )}

        {/* Created at */}
        <div>
          <span className="text-[var(--frost)] text-xs uppercase tracking-wide">Created</span>
          <p className="mt-0.5 text-[var(--ice-white)]">
            {new Date(node.createdAt).toLocaleString()}
          </p>
        </div>

        {/* Manifest ID */}
        <div>
          <span className="text-[var(--frost)] text-xs uppercase tracking-wide">ID</span>
          <p className="mt-0.5 font-mono text-xs text-[var(--mist)] break-all">{node.id}</p>
        </div>

        {/* Restart error */}
        {restartError && (
          <p className="text-xs text-[var(--error)]">{restartError}</p>
        )}
      </div>

      {/* Footer — Restart button */}
      {canRestart && (
        <div className="border-t border-[var(--shadow)] px-4 py-3">
          <button
            onClick={() => { void handleRestart(); }}
            disabled={restarting}
            className="w-full rounded-lg border border-[var(--cyan)] bg-transparent px-3 py-2 text-sm font-medium text-[var(--cyan)] transition-colors hover:bg-[var(--cyan)]/10 disabled:opacity-50"
          >
            {restarting ? 'Restarting…' : 'Restart Job'}
          </button>
        </div>
      )}
    </div>
  );
}
