/**
 * Ghost Privacy — Layer 3: Contextual Defaults
 *
 * checkFileLayer3()  — check a file path against sensitive directory defaults
 * checkEmailLayer3() — check an email subject for sensitive/privileged patterns
 *
 * These are code-level defaults, not DB-backed. David can override via Layer 4
 * (user exclusions) but cannot directly edit these lists. Sprint 6G Privacy
 * Dashboard surfaces Layer 4 for user control.
 */

import type { ExclusionResult } from './types';
import { NOT_EXCLUDED } from './types';

// ─── Sensitive directory components ──────────────────────────────────────────
// Directories where content should be excluded unless the user explicitly opts in via Layer 4

const SENSITIVE_DIR_COMPONENTS = new Set([
  'medical', 'legal', 'attorney', 'privileged', 'therapy', 'health',
]);

// ─── Sensitive email subject substrings (case-insensitive) ───────────────────

const SENSITIVE_SUBJECT_PATTERNS = [
  'attorney-client',
  'privileged',
  'confidential',
  'do not forward',
  'legal hold',
  'attorney client',
  'work product',
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check a file path against Layer 3 contextual directory defaults.
 */
export function checkFileLayer3(filePath: string): ExclusionResult {
  const normalised = filePath.replace(/\\/g, '/');
  const components = normalised.split('/').filter(Boolean);

  for (const component of components) {
    if (SENSITIVE_DIR_COMPONENTS.has(component.toLowerCase())) {
      return {
        excluded: true, layer: 3,
        reason: 'sensitive directory (contextual default)',
        pattern: component,
      };
    }
  }

  return NOT_EXCLUDED;
}

/**
 * Check an email subject line against Layer 3 contextual defaults.
 * Uses subject line only — domain-based exclusion is Layer 4 (user-configured).
 */
export function checkEmailLayer3(subject: string): ExclusionResult {
  const lower = subject.toLowerCase();

  for (const pattern of SENSITIVE_SUBJECT_PATTERNS) {
    if (lower.includes(pattern)) {
      return {
        excluded: true, layer: 3,
        reason: 'sensitive email subject (contextual default)',
        pattern,
      };
    }
  }

  return NOT_EXCLUDED;
}
