/**
 * Already-Built Gate — pre-manifest check (Sprint 3F)
 *
 * Before a manifest is submitted to the Agent SDK, checkBeforeManifest()
 * embeds the manifest title + description and queries the vector index.
 * If any chunk exceeds the alreadyBuiltGate threshold, the gate fires and
 * the UI intercepts the spawn with AlreadyBuiltModal.
 *
 * @module lib/cross-context/gate
 */

import { findSimilarChunks } from '@/lib/vector';
import { loadThresholds } from './thresholds';
import type { TaskManifest } from '@/lib/agent-sdk/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GateMatch {
  chunkId: string;
  content: string;
  similarity: number;
  sourceId: string;
}

export interface GateResult {
  shouldIntercept: boolean;
  matches: GateMatch[];
}

// ── Gate check ────────────────────────────────────────────────────────────────

/**
 * Check if a manifest description matches existing work above the
 * alreadyBuiltGate threshold. Returns shouldIntercept=true and the
 * matching chunks if any are found.
 */
export async function checkBeforeManifest(
  manifest: TaskManifest
): Promise<GateResult> {
  const queryText = `${manifest.task.title} ${manifest.task.description}`;
  const thresholds = loadThresholds();
  const threshold = thresholds.alreadyBuiltGate;

  const matches = await findSimilarChunks(queryText, 10, threshold);

  return {
    shouldIntercept: matches.length > 0,
    matches: matches.map((m) => ({
      chunkId: m.chunkId,
      content: m.content,
      similarity: m.similarity,
      sourceId: m.sourceId,
    })),
  };
}
