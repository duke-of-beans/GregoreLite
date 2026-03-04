/**
 * Decision Gate — Trigger Detector
 *
 * Evaluates all 8 trigger conditions against a conversation.
 * Conditions are OR-logic — first match wins.
 *
 * LIVE (Sprint 4A — keyword/semantic heuristics):
 *   repeated_question, sacred_principle_risk, irreversible_action,
 *   contradicts_prior, low_confidence
 *
 * HAIKU INFERENCE (Sprint 4B — single inference call, three structured results):
 *   high_tradeoff_count, multi_project_touch, large_build_estimate
 *   → Evaluated via inferStructuredTriggers() in decision-gate/inference.ts.
 *     The three always-false stub functions have been removed.
 */

import type { GateMessage } from './types';

// ─── repeated_question ────────────────────────────────────────────────────────

/**
 * Extract 3-gram phrases from a message for topic overlap detection.
 * Filters common stop words to reduce noise.
 */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
  'it', 'its', 'we', 'i', 'you', 'he', 'she', 'they', 'what', 'how',
  'why', 'when', 'where', 'which', 'who', 'if', 'then', 'so', 'as',
  'up', 'out', 'about', 'into', 'just', 'my', 'our', 'your',
]);

function extractKeyPhrases(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));

  const phrases: string[] = [...tokens]; // unigrams first

  // Add bigrams
  for (let i = 0; i < tokens.length - 1; i++) {
    const t1 = tokens[i];
    const t2 = tokens[i + 1];
    if (t1 !== undefined && t2 !== undefined) {
      phrases.push(`${t1} ${t2}`);
    }
  }

  // Add trigrams
  for (let i = 0; i < tokens.length - 2; i++) {
    const t1 = tokens[i];
    const t2 = tokens[i + 1];
    const t3 = tokens[i + 2];
    if (t1 !== undefined && t2 !== undefined && t3 !== undefined) {
      phrases.push(`${t1} ${t2} ${t3}`);
    }
  }

  return phrases;
}

/**
 * Fires when the same core topic appears in 3+ user messages within
 * the last 10 user messages — signals David circling an unresolved question.
 */
export function detectRepeatedQuestion(messages: GateMessage[]): boolean {
  const userMessages = messages.filter((m) => m.role === 'user').slice(-10);
  if (userMessages.length < 3) return false;

  const phraseSets = userMessages.map((m) => extractKeyPhrases(m.content));

  const phraseCounts = new Map<string, number>();
  for (const msgPhrases of phraseSets) {
    // Deduplicate within a single message to avoid phrase self-reinforcement
    const unique = new Set(msgPhrases);
    for (const phrase of unique) {
      phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1);
    }
  }

  return [...phraseCounts.values()].some((count) => count >= 3);
}

// ─── sacred_principle_risk ────────────────────────────────────────────────────

const SACRED_PRINCIPLE_PHRASES = [
  'temporary fix',
  'temp fix',
  'quick fix',
  'technical debt',
  'tech debt',
  'mvp of',
  'mvp version',
  'just for now',
  'for now',
  'we can do this later',
  'fix later',
  'good enough for now',
  'ship it and fix',
  'hack for now',
  'workaround for now',
  'stop gap',
  'stopgap',
  'short term fix',
  'short-term fix',
];

/**
 * Fires when forbidden phrases indicating technical debt or temporary solutions
 * appear in the last 5 messages. These violate Option B Perfection.
 */
export function detectSacredPrincipleRisk(messages: GateMessage[]): boolean {
  const recent = messages
    .slice(-5)
    .map((m) => m.content.toLowerCase())
    .join(' ');
  return SACRED_PRINCIPLE_PHRASES.some((phrase) => recent.includes(phrase));
}

// ─── irreversible_action ──────────────────────────────────────────────────────

const IRREVERSIBLE_PATTERNS = [
  /drop\s+table/i,
  /delete\s+from/i,
  /truncate\s+table/i,
  /truncate\s+the/i,
  /deploy\s+to\s+prod/i,
  /push\s+to\s+main/i,
  /merge\s+to\s+main/i,
  /merge\s+into\s+main/i,
  /breaking\s+change/i,
  /breaking\s+schema/i,
  /remove\s+the\s+\w+\s+column/i,
  /rename\s+the\s+\w+\s+table/i,
  /delete\s+the\s+\w+\s+table/i,
  /force\s+push/i,
  /--force/i,
  /wipe\s+the\s+database/i,
  /drop\s+the\s+database/i,
  /irreversible/i,
];

/**
 * Fires when the last assistant message proposes an action that cannot be
 * easily undone — schema drops, force pushes, production deployments.
 */
export function detectIrreversibleAction(messages: GateMessage[]): boolean {
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  if (!lastAssistant) return false;
  return IRREVERSIBLE_PATTERNS.some((p) => p.test(lastAssistant.content));
}

// ─── low_confidence ───────────────────────────────────────────────────────────

const LOW_CONFIDENCE_PHRASES = [
  "i'm not sure",
  "i'm uncertain",
  "i'm not confident",
  "not certain",
  "this might not",
  "this could break",
  "i'd need to verify",
  "i would need to verify",
  "not 100%",
  "approximately",
  "roughly speaking",
  "you may want to double-check",
  "worth verifying",
  "i cannot guarantee",
  "i can't guarantee",
  "there's a risk",
  "there is a risk",
  "i'm making an assumption",
  "i'm assuming",
  "you should verify",
  "you should double-check",
];

/**
 * Fires when the last assistant message contains 2+ uncertainty phrases —
 * Claude is signalling it lacks the confidence needed to proceed safely.
 */
export function detectLowConfidence(messages: GateMessage[]): boolean {
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  if (!lastAssistant) return false;
  const lower = lastAssistant.content.toLowerCase();
  const matchCount = LOW_CONFIDENCE_PHRASES.filter((p) => lower.includes(p)).length;
  return matchCount >= 2;
}


