/**
 * Proactive Surfacing — on-input trigger (Sprint 3G)
 *
 * checkOnInput() is called fire-and-forget from the chat route after every
 * user message. It runs the full ranking pipeline and returns the top 2
 * suggestions above the onInputSuggestion threshold.
 *
 * Inserts each surfaced suggestion into the DB so feedback can be recorded.
 *
 * @module lib/cross-context/proactive
 */

import { findSimilarChunks } from '@/lib/vector';
import { loadThresholds } from './thresholds';
import { isSuppressed, scoreCandidate } from './surfacing';
import { insertSuggestion } from './feedback';
import type { Suggestion } from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Messages shorter than this are unlikely to be semantically meaningful. */
const MIN_MESSAGE_LENGTH = 50;

/** Number of vector candidates to retrieve before scoring. */
const CANDIDATE_COUNT = 20;

/** Minimum display score to surface a suggestion. */
const MIN_DISPLAY_SCORE = 0.70;

/** Maximum suggestions returned. */
const MAX_RESULTS = 2;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Check whether a user message should surface any proactive suggestions.
 *
 * Pipeline:
 *   1. Skip messages shorter than 50 chars (too short to be meaningful)
 *   2. Embed message and query vec_index at onInputSuggestion threshold
 *   3. Filter suppressed chunks
 *   4. Score each candidate with the full ranking formula
 *   5. Filter by MIN_DISPLAY_SCORE (0.70) and sort descending
 *   6. Persist top 2 to suggestions table and return them
 *
 * Called fire-and-forget — callers must not await this for response latency.
 */
export async function checkOnInput(
  userMessage: string,
  activeProjectId?: string
): Promise<Suggestion[]> {
  if (userMessage.length < MIN_MESSAGE_LENGTH) return [];

  const thresholds = loadThresholds();
  const candidates = await findSimilarChunks(
    userMessage,
    CANDIDATE_COUNT,
    thresholds.onInputSuggestion
  );

  const scored: Array<Suggestion> = [];

  for (const candidate of candidates) {
    if (isSuppressed(candidate.chunkId)) continue;

    const context = activeProjectId !== undefined ? { activeProjectId } : {};
    const displayScore = scoreCandidate(candidate, context);
    if (displayScore < MIN_DISPLAY_SCORE) continue;

    // Persist to DB so the suggestion ID can be used for feedback recording
    const suggestionId = insertSuggestion(
      candidate.chunkId,
      candidate.similarity,
      displayScore,
      'on_input'
    );

    scored.push({
      id: suggestionId,
      chunkId: candidate.chunkId,
      content: candidate.content,
      sourceType: candidate.sourceType,
      sourceId: candidate.sourceId,
      similarityScore: candidate.similarity,
      displayScore,
      surfacedAt: Date.now(),
    });
  }

  return scored
    .sort((a, b) => b.displayScore - a.displayScore)
    .slice(0, MAX_RESULTS);
}
