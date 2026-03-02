/**
 * Ghost Privacy Engine — Public API
 *
 * checkFile()   — run all 4 layers against a file path + content
 * checkEmail()  — run all 4 layers against an email message
 * checkChunk()  — run Layer 2 PII scan on a single text chunk
 * logExclusion() — write an audit row to ghost_exclusion_log
 *
 * Layer order: 1 (path, hardcoded) → 3 (contextual defaults) → 4 (user rules)
 * → content read → 1 (content) → chunks → 2 (PII per-chunk)
 *
 * Any excluded result short-circuits immediately — remaining layers not run.
 */

import { nanoid } from 'nanoid';
import { getDatabase } from '@/lib/kernl/database';
import { checkPathLayer1, checkContentLayer1 } from './layer1';
import { checkChunkLayer2 } from './layer2';
import { checkFileLayer3, checkEmailLayer3 } from './layer3';
import { checkFileLayer4, checkEmailLayer4 } from './layer4';
import type { ExclusionResult } from './types';
import { NOT_EXCLUDED } from './types';
import type { EmailMessage } from '@/lib/ghost/email/types';

// ─── Audit logging ────────────────────────────────────────────────────────────

export function logExclusion(
  sourceType: 'file' | 'email',
  sourcePath: string,
  result: ExclusionResult
): void {
  if (!result.excluded || result.layer === undefined) return;
  const db = getDatabase();
  db.prepare(`
    INSERT INTO ghost_exclusion_log
      (id, source_type, source_path, layer, reason, pattern, logged_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    nanoid(),
    sourceType,
    sourcePath,
    result.layer,
    result.reason ?? '',
    result.pattern ?? null,
    Date.now()
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run all pre-read path checks for a file (Layers 1, 3, 4).
 * Call this BEFORE reading the file — if excluded, skip the read entirely.
 */
export function checkFilePath(filePath: string): ExclusionResult {
  const l1 = checkPathLayer1(filePath);
  if (l1.excluded) return l1;

  const l3 = checkFileLayer3(filePath);
  if (l3.excluded) return l3;

  const l4 = checkFileLayer4(filePath);
  if (l4.excluded) return l4;

  return NOT_EXCLUDED;
}

/**
 * Run Layer 1 content check on file content.
 * Call this AFTER reading the file, BEFORE chunking.
 */
export function checkFileContent(content: string): ExclusionResult {
  return checkContentLayer1(content);
}

/**
 * Run Layer 2 PII scan on a single chunk.
 * Call this per-chunk before embedding.
 */
export function checkChunk(text: string): ExclusionResult {
  return checkChunkLayer2(text);
}

/**
 * Run all applicable layers for an email message.
 * Call this before chunking the email body.
 * Returns the first exclusion triggered, or NOT_EXCLUDED.
 */
export function checkEmail(message: EmailMessage): ExclusionResult {
  // Layer 3: subject-based contextual defaults
  const l3 = checkEmailLayer3(message.subject);
  if (l3.excluded) return l3;

  // Layer 4: user-configured domain/sender/subject rules
  const l4 = checkEmailLayer4(message.from, message.subject);
  if (l4.excluded) return l4;

  return NOT_EXCLUDED;
}

// ─── Re-exports for consumers ─────────────────────────────────────────────────

export { getUserExclusions, addExclusion, removeExclusion } from './layer4';
export type { ExclusionResult, ExclusionLayer, GhostExclusion, ExclusionType } from './types';
export { NOT_EXCLUDED } from './types';
