/**
 * Transit Map — Topic Shift Detector
 * Sprint 11.3 | Spec: TRANSIT_MAP_SPEC.md §2.2 (flow.topic_shift)
 *
 * Detects when a user message represents a significant topic change relative
 * to the previous user message. Uses Jaccard similarity on keyword overlap
 * as a lightweight heuristic — no embedding model required at this stage.
 *
 * Approach documented here to satisfy the authority protocol note:
 *   "check if lib/embeddings/ exists. If no embedding infrastructure, use
 *    a simpler heuristic (Jaccard similarity on TF-IDF vectors, or keyword
 *    overlap ratio)."
 *
 * Embeddings exist (@xenova/transformers, see BLUEPRINT §5.1) but are async
 * and would add 100-300ms latency to every user message. Jaccard is synchronous,
 * ~0ms, and sufficient for detecting coarse topic shifts. Fine-grained semantic
 * similarity is a Phase B upgrade once we have baseline telemetry data.
 *
 * Threshold default: 0.4 — similarity below this = topic shift.
 * Per TRANSIT_MAP_SPEC.md §8 Q1: "What's the right topic shift threshold?
 * Needs tuning on real conversation data."
 */

// ── Stopword set ──────────────────────────────────────────────────────────────

/**
 * Common English stopwords excluded from similarity calculation.
 * These carry no topical signal and would inflate similarity scores spuriously.
 */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'can', 'shall', 'that', 'this',
  'these', 'those', 'it', 'its', 'he', 'she', 'they', 'we', 'i', 'you',
  'my', 'your', 'his', 'her', 'our', 'their', 'what', 'which', 'who',
  'when', 'where', 'why', 'how', 'all', 'any', 'not', 'no', 'so', 'if',
  'then', 'than', 'as', 'up', 'out', 'about', 'into', 'through', 'also',
  'just', 'more', 'very', 'now', 'here', 'there', 'get', 'make', 'use',
]);

// ── Token extraction ──────────────────────────────────────────────────────────

/**
 * Tokenize a message into a deduplicated set of meaningful keywords.
 * Lowercases, splits on non-word characters, drops stopwords and short tokens.
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\W+/)
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t)),
  );
}

// ── Jaccard similarity ────────────────────────────────────────────────────────

/**
 * Jaccard similarity between two token sets: |A ∩ B| / |A ∪ B|.
 * Returns 1.0 for identical sets, 0.0 for completely disjoint sets.
 * Returns 1.0 (no shift) when both sets are empty.
 */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1.0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 1.0 : intersection / union;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface TopicShiftResult {
  /** True when similarity < threshold (topic changed) */
  isShift: boolean;
  /** Jaccard similarity score 0–1. Lower = more different topics. */
  similarity: number;
  /**
   * Inferred topic label from the current message.
   * First 60 characters of the message (trimmed). Empty when too short to judge.
   */
  inferredTopic: string;
}

/**
 * Detects a topic shift between two consecutive user messages.
 *
 * Returns { isShift: false, similarity: 1, inferredTopic: '' } for messages
 * with fewer than 3 meaningful tokens — too short to make a reliable judgment.
 *
 * @param previousMessage - The prior user message content
 * @param currentMessage  - The new user message content
 * @param threshold       - Similarity below this = shift detected (default 0.4)
 */
export function detectTopicShift(
  previousMessage: string,
  currentMessage: string,
  threshold = 0.4,
): TopicShiftResult {
  const prevTokens = tokenize(previousMessage);
  const currTokens = tokenize(currentMessage);

  // Too short to judge — don't fire a spurious topic_shift
  if (prevTokens.size < 3 || currTokens.size < 3) {
    return { isShift: false, similarity: 1, inferredTopic: '' };
  }

  const similarity = jaccard(prevTokens, currTokens);
  const isShift = similarity < threshold;
  const inferredTopic = isShift
    ? currentMessage.trim().slice(0, 60)
    : '';

  return { isShift, similarity, inferredTopic };
}
