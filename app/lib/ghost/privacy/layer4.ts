/**
 * Ghost Privacy — Layer 4: User-Configurable Exclusions
 *
 * checkFileLayer4()   — match file path against user exclusion rules
 * checkEmailLayer4()  — match email fields against user exclusion rules
 * getUserExclusions() — read all rules from ghost_exclusions table
 * addExclusion()      — insert a new rule
 * removeExclusion()   — delete a rule by ID
 *
 * The exclusion list is cached in memory for 5 minutes to avoid per-item
 * DB reads. Cache invalidates automatically on add/remove.
 */

import micromatch from 'micromatch';
import { nanoid } from 'nanoid';
import { getDatabase } from '@/lib/kernl/database';
import type { GhostExclusion, ExclusionResult, ExclusionType } from './types';
import { NOT_EXCLUDED } from './types';

// ─── 5-minute in-memory cache ─────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;
let _cache: GhostExclusion[] | null = null;
let _cacheAt = 0;

function invalidateCache(): void {
  _cache = null;
  _cacheAt = 0;
}

function loadExclusions(): GhostExclusion[] {
  const now = Date.now();
  if (_cache && now - _cacheAt < CACHE_TTL_MS) return _cache;

  const db = getDatabase();
  _cache = db
    .prepare('SELECT * FROM ghost_exclusions ORDER BY created_at DESC')
    .all() as GhostExclusion[];
  _cacheAt = now;
  return _cache;
}

// ─── Public CRUD ──────────────────────────────────────────────────────────────

export function getUserExclusions(): GhostExclusion[] {
  return loadExclusions();
}

export function addExclusion(
  type: ExclusionType,
  pattern: string,
  note?: string
): void {
  const db = getDatabase();
  db.prepare(
    'INSERT INTO ghost_exclusions (id, type, pattern, created_at, note) VALUES (?, ?, ?, ?, ?)'
  ).run(nanoid(), type, pattern, Date.now(), note ?? null);
  invalidateCache();
}

export function removeExclusion(id: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM ghost_exclusions WHERE id = ?').run(id);
  invalidateCache();
}

// ─── Matching helpers ─────────────────────────────────────────────────────────

function matchGlob(pattern: string, filePath: string): boolean {
  const normalised = filePath.replace(/\\/g, '/');
  return micromatch.isMatch(normalised, pattern, { nocase: true });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check a file path against Layer 4 user exclusions.
 */
export function checkFileLayer4(filePath: string): ExclusionResult {
  const exclusions = loadExclusions();

  for (const ex of exclusions) {
    if (ex.type === 'path_glob' && matchGlob(ex.pattern, filePath)) {
      return {
        excluded: true, layer: 4,
        reason: 'user exclusion: path_glob',
        pattern: ex.pattern,
      };
    }
    if (ex.type === 'keyword') {
      const lower = filePath.toLowerCase();
      if (lower.includes(ex.pattern.toLowerCase())) {
        return {
          excluded: true, layer: 4,
          reason: 'user exclusion: keyword in path',
          pattern: ex.pattern,
        };
      }
    }
  }

  return NOT_EXCLUDED;
}

/**
 * Check an email against Layer 4 user exclusions (domain, sender, subject).
 */
export function checkEmailLayer4(
  from: string,
  subject: string
): ExclusionResult {
  const exclusions = loadExclusions();
  const fromLower = from.toLowerCase();
  const subjectLower = subject.toLowerCase();

  for (const ex of exclusions) {
    if (ex.type === 'domain') {
      if (fromLower.includes(`@${ex.pattern.toLowerCase()}`)) {
        return {
          excluded: true, layer: 4,
          reason: 'user exclusion: email domain',
          pattern: ex.pattern,
        };
      }
    }
    if (ex.type === 'sender') {
      if (fromLower.includes(ex.pattern.toLowerCase())) {
        return {
          excluded: true, layer: 4,
          reason: 'user exclusion: email sender',
          pattern: ex.pattern,
        };
      }
    }
    if (ex.type === 'subject_contains') {
      if (subjectLower.includes(ex.pattern.toLowerCase())) {
        return {
          excluded: true, layer: 4,
          reason: 'user exclusion: subject contains',
          pattern: ex.pattern,
        };
      }
    }
    if (ex.type === 'keyword') {
      if (subjectLower.includes(ex.pattern.toLowerCase()) ||
          fromLower.includes(ex.pattern.toLowerCase())) {
        return {
          excluded: true, layer: 4,
          reason: 'user exclusion: keyword',
          pattern: ex.pattern,
        };
      }
    }
  }

  return NOT_EXCLUDED;
}
