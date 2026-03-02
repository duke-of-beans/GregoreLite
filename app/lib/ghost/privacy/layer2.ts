/**
 * Ghost Privacy — Layer 2: PII Content Scanner
 *
 * checkChunkLayer2() — scan a chunk of text for PII before embedding
 *
 * Detects: SSNs, credit card numbers (Luhn-validated), API keys, JWT tokens.
 * Operates per-chunk — a file with one PII chunk discards only that chunk,
 * not the entire file.
 */

import { extractCardNumbers } from './luhn';
import type { ExclusionResult } from './types';
import { NOT_EXCLUDED } from './types';

// ─── SSN pattern ──────────────────────────────────────────────────────────────
// NNN-NN-NNNN, not preceded/followed by a letter within 2 chars
// (avoids false positives on version strings like "3-4-2024")
const SSN_RE = /\b(\d{3})-(\d{2})-(\d{4})\b/g;

// Heuristic: if the char immediately adjacent (touching) the match is a letter,
// it's likely part of an identifier like "v3-4-2024", not an SSN.
// We only check 1 position away so "SSN: 123-45-6789" (space separator) still passes.
function isLikelySSN(text: string, matchIndex: number, matchLength: number): boolean {
  const before = matchIndex > 0 ? (text[matchIndex - 1] ?? '') : '';
  const after = matchIndex + matchLength < text.length ? (text[matchIndex + matchLength] ?? '') : '';
  return !/[a-zA-Z]/.test(before) && !/[a-zA-Z]/.test(after);
}

// ─── API key patterns ─────────────────────────────────────────────────────────

const API_KEY_PATTERNS: Array<{ re: RegExp; name: string }> = [
  { re: /\bsk-[a-zA-Z0-9]{20,}\b/, name: 'OpenAI/Anthropic secret key' },
  { re: /\bpk-[a-zA-Z0-9]{20,}\b/, name: 'Stripe public key' },
  { re: /\bghp_[a-zA-Z0-9]{36}\b/, name: 'GitHub personal access token' },
  { re: /\bghs_[a-zA-Z0-9]{36}\b/, name: 'GitHub app token' },
  { re: /\bxox[bpas]-[a-zA-Z0-9-]{10,}\b/, name: 'Slack token' },
  { re: /\bAKIA[0-9A-Z]{16}\b/, name: 'AWS access key' },
  { re: /\bya29\.[a-zA-Z0-9_-]{20,}\b/, name: 'Google OAuth token' },
];

// ─── JWT pattern ──────────────────────────────────────────────────────────────
// Three base64url segments separated by dots; verify header decodes as JWT
const JWT_RE = /\b([a-zA-Z0-9_-]{10,})\.([a-zA-Z0-9_-]{10,})\.([a-zA-Z0-9_-]{10,})\b/;

function isJWT(text: string): boolean {
  const match = JWT_RE.exec(text);
  if (!match) return false;
  try {
    // Decode the header segment (first part)
    const headerB64 = (match[1] ?? '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = headerB64 + '='.repeat((4 - (headerB64.length % 4)) % 4);
    const header = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as unknown;
    if (typeof header !== 'object' || header === null) return false;
    const h = header as Record<string, unknown>;
    // Must have alg field (standard JWT header claim)
    return typeof h['alg'] === 'string' || typeof h['typ'] === 'string';
  } catch {
    return false;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Scan chunk text for PII patterns.
 * Returns an exclusion if any PII is found; otherwise NOT_EXCLUDED.
 * Called per-chunk before embedding.
 */
export function checkChunkLayer2(text: string): ExclusionResult {
  // SSN
  let ssnMatch: RegExpExecArray | null;
  SSN_RE.lastIndex = 0;
  while ((ssnMatch = SSN_RE.exec(text)) !== null) {
    if (isLikelySSN(text, ssnMatch.index, ssnMatch[0].length)) {
      return {
        excluded: true, layer: 2,
        reason: 'SSN pattern detected',
        pattern: 'SSN \\d{3}-\\d{2}-\\d{4}',
      };
    }
  }

  // Credit card (Luhn-validated)
  const cards = extractCardNumbers(text);
  if (cards.length > 0) {
    return {
      excluded: true, layer: 2,
      reason: 'credit card number detected (Luhn valid)',
      pattern: 'credit-card',
    };
  }

  // API keys
  for (const { re, name } of API_KEY_PATTERNS) {
    if (re.test(text)) {
      return { excluded: true, layer: 2, reason: `API key detected: ${name}`, pattern: name };
    }
  }

  // JWT
  if (isJWT(text)) {
    return { excluded: true, layer: 2, reason: 'JWT token detected', pattern: 'JWT' };
  }

  return NOT_EXCLUDED;
}
