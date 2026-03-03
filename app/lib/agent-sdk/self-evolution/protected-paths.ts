/**
 * protected-paths.ts — Protected Path Enforcement — Phase 7H
 *
 * Two-layer protection for self-evolution sessions:
 *
 *   Layer 1 — Hard-coded protected directories (non-negotiable, cannot be user-overridden):
 *     - app/lib/agent-sdk/          (the modification engine itself)
 *     - app/lib/kernl/core/         (KERNL core persistence)
 *     - app/lib/agent-sdk/self-evolution/  (self-evolution orchestrator)
 *     - Any file containing // @no-self-evolve on any line
 *
 *   Layer 2 — .gregignore file at repo root (user-editable additional exclusions).
 *     Supports glob patterns via micromatch.
 *
 * Both layers are checked at manifest generation time (before spawn) AND at the
 * tool layer during execution (fs_write intercept in query.ts for self_evolution
 * session type).
 *
 * BLUEPRINT §7.5
 */

import fs from 'fs';
import path from 'path';
import micromatch from 'micromatch';

// ─── Hard-coded protected prefixes (relative to repo root, normalised to forward slashes) ───

const HARD_PROTECTED_PREFIXES: readonly string[] = [
  'app/lib/agent-sdk/',
  'app/lib/kernl/core/',
  'app/lib/agent-sdk/self-evolution/',
];

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ProtectionCheckResult {
  protected: boolean;
  reason: string | null;
}

/**
 * isProtectedPath — check whether a file path is protected from self-evolution writes.
 *
 * @param filePath   Absolute or project-relative path to check.
 * @param repoRoot   Absolute path to the repo root (for .gregignore resolution).
 */
export function isProtectedPath(filePath: string, repoRoot: string): ProtectionCheckResult {
  const relative = normalise(filePath, repoRoot);

  // ── Layer 1a: hard-coded directory prefixes ─────────────────────────────────
  for (const prefix of HARD_PROTECTED_PREFIXES) {
    if (relative.startsWith(prefix) || relative === prefix.replace(/\/$/, '')) {
      return { protected: true, reason: `Hard-protected path: ${prefix}` };
    }
  }

  // ── Layer 1b: @no-self-evolve annotation ────────────────────────────────────
  const abs = path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath);
  if (fs.existsSync(abs)) {
    try {
      const content = fs.readFileSync(abs, 'utf8');
      if (content.includes('// @no-self-evolve')) {
        return { protected: true, reason: '@no-self-evolve annotation found in file' };
      }
    } catch {
      // Unreadable file — treat as protected
      return { protected: true, reason: 'File could not be read for annotation check' };
    }
  }

  // ── Layer 2: .gregignore patterns ───────────────────────────────────────────
  const gregignorePatterns = loadGregignore(repoRoot);
  if (gregignorePatterns.length > 0 && micromatch.isMatch(relative, gregignorePatterns)) {
    return { protected: true, reason: `.gregignore match: ${relative}` };
  }

  return { protected: false, reason: null };
}

/**
 * filterProtectedFiles — given a list of file paths, return those that are NOT protected.
 * Also returns the rejected list with reasons for audit logging.
 */
export function filterProtectedFiles(
  files: string[],
  repoRoot: string,
): {
  allowed: string[];
  rejected: Array<{ path: string; reason: string }>;
} {
  const allowed: string[] = [];
  const rejected: Array<{ path: string; reason: string }> = [];

  for (const f of files) {
    const check = isProtectedPath(f, repoRoot);
    if (check.protected) {
      rejected.push({ path: f, reason: check.reason ?? 'unknown' });
    } else {
      allowed.push(f);
    }
  }

  return { allowed, rejected };
}

// ─── Internals ─────────────────────────────────────────────────────────────────

/** Normalise a file path to a forward-slash relative path from repoRoot. */
function normalise(filePath: string, repoRoot: string): string {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath);
  return path.relative(repoRoot, abs).replace(/\\/g, '/');
}

/** Load and parse the .gregignore file, returning an array of micromatch patterns. */
export function loadGregignore(repoRoot: string): string[] {
  const gregignorePath = path.join(repoRoot, '.gregignore');
  if (!fs.existsSync(gregignorePath)) return [];

  try {
    return fs.readFileSync(gregignorePath, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));
  } catch {
    return [];
  }
}
