/**
 * Ghost Privacy — Luhn Algorithm
 *
 * isValidLuhn()       — validate a digit string with Luhn checksum
 * extractCardNumbers() — find candidate card numbers in a text string
 *
 * False positive tuning:
 *   - Requires 13–19 digits (covers all major card schemes)
 *   - Candidate must not be a pure sequential run (1234567890123) — too common in test data
 *   - Candidate must not be all the same digit (4444444444444444)
 *   - Strips spaces and dashes before checking (e.g. "4111 1111 1111 1111")
 */

// ─── Luhn checksum ────────────────────────────────────────────────────────────

/**
 * Returns true if the digit string passes the Luhn checksum.
 * Input must be digits only (no spaces or dashes).
 */
export function isValidLuhn(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i]!, 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

// ─── False positive filters ───────────────────────────────────────────────────

/** Returns true if the digit string is trivially sequential (ascending or descending run). */
function isSequentialRun(digits: string): boolean {
  if (digits.length < 4) return false;
  let ascending = true;
  let descending = true;
  for (let i = 1; i < digits.length; i++) {
    const cur = parseInt(digits[i]!, 10);
    const prev = parseInt(digits[i - 1]!, 10);
    if (cur !== prev + 1) ascending = false;
    if (cur !== prev - 1) descending = false;
    if (!ascending && !descending) break;
  }
  return ascending || descending;
}

/** Returns true if all digits are the same (e.g. 4444444444444444). */
function isAllSameDigit(digits: string): boolean {
  return new Set(digits.split('')).size === 1;
}

// ─── Candidate extraction ─────────────────────────────────────────────────────

/**
 * Extracts candidate credit card digit strings from text.
 * Matches 13–19 consecutive digits, optionally separated by spaces or dashes.
 * Returns only candidates that pass Luhn and are not obviously fake.
 */
export function extractCardNumbers(text: string): string[] {
  // Match digit groups optionally separated by spaces or dashes
  const RE = /\b(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,7}|\d{13,19})\b/g;
  const results: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = RE.exec(text)) !== null) {
    const raw = match[1] ?? '';
    const digits = raw.replace(/[\s-]/g, '');

    if (digits.length < 13 || digits.length > 19) continue;
    if (isAllSameDigit(digits)) continue;
    if (isSequentialRun(digits)) continue;
    if (!isValidLuhn(digits)) continue;

    results.push(digits);
  }

  return results;
}
