/**
 * Decision Gate — Contradiction Detector
 *
 * Checks whether the user's latest message is semantically similar to a
 * previously logged KERNL decision. A match suggests the proposed action
 * may contradict something David already decided.
 *
 * Uses Phase 3's findSimilarChunks() against the vec_index, filtering
 * to source_type === 'decision'. Similarity floor: 0.80.
 *
 * Sprint 4A: flags any similar decision (binary match).
 * Sprint 4B: refines with UI to display the specific conflict + rationale.
 */

import { findSimilarChunks } from '@/lib/vector';
import type { GateMessage } from './types';

/** Minimum cosine similarity to treat a chunk as a potential contradiction. */
const CONTRADICTION_THRESHOLD = 0.80;

/**
 * Fires when the last user message is semantically close to a prior
 * decision logged in the KERNL decision registry.
 *
 * Returns false (no trigger) if:
 *   - There are no user messages
 *   - The vec_index is empty or inaccessible (fails safe — never blocks)
 *   - No decision chunks meet the similarity threshold
 */
export async function detectContradiction(messages: GateMessage[]): Promise<boolean> {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUser) return false;

  try {
    const similar = await findSimilarChunks(
      lastUser.content,
      5,
      CONTRADICTION_THRESHOLD
    );

    // Only flag if the similar content comes from a decision chunk
    const decisionChunks = similar.filter((c) => c.sourceType === 'decision');
    return decisionChunks.length > 0;
  } catch {
    // If the vector index is unavailable (e.g., first boot before any
    // embeddings are written), fail open — don't block the conversation.
    return false;
  }
}
