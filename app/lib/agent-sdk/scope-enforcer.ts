/**
 * scope-enforcer.ts — Write Scope Enforcement — Phase 7B
 *
 * Second layer of write protection (first layer is tool injection — write tools
 * simply are not present in readOnly sessions). For sessions that DO have write
 * tools, every proposed write path is validated against manifest.files[] and
 * against CWD policy (e.g. docs-only sessions). Rejections are logged to
 * scope_violations so every enforcement action is auditable.
 *
 * BLUEPRINT §4.3.3
 */

import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';

import { getDatabase } from '../kernl/database';
import type { TaskManifest } from './types';
import type { TaskType } from './types';
import { PERMISSION_CONFIG } from './permission-config';

// ─── CWD resolution ───────────────────────────────────────────────────────────

/**
 * resolveCwd — returns the effective working directory for a session based on
 * the session type's CWdPolicy and the manifest's project_path.
 */
export function resolveCwd(sessionType: TaskType, projectPath: string, manifestId: string): string {
  const { cwdPolicy } = PERMISSION_CONFIG[sessionType];
  switch (cwdPolicy) {
    case 'project_root':
      return projectPath;
    case 'docs_subdir':
      return path.join(projectPath, 'docs');
    case 'temp_workspace':
      return path.join(os.tmpdir(), 'greglite-sessions', manifestId);
    default:
      return projectPath;
  }
}

// ─── Scope violation logging ──────────────────────────────────────────────────

export interface ScopeViolationRecord {
  manifest_id:    string;
  attempted_path: string;
  resolved_path:  string;
  session_type:   string;
}

/**
 * logScopeViolation — writes a rejected write attempt to the scope_violations table.
 * Non-throwing: any DB error is swallowed so enforcement never crashes the session.
 */
export function logScopeViolation(record: ScopeViolationRecord): void {
  try {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO scope_violations (id, manifest_id, attempted_path, resolved_path, session_type, logged_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      record.manifest_id,
      record.attempted_path,
      record.resolved_path,
      record.session_type,
      Date.now()
    );
  } catch {
    // Non-fatal — enforcement already happened (write was rejected).
    // DB logging failure must not unwind the session.
  }
}

// ─── Write scope validation ───────────────────────────────────────────────────

export interface WriteCheckResult {
  allowed: boolean;
  /** Populated only when allowed === false. Pass directly to the agent as tool result. */
  errorMessage?: string;
}

/**
 * checkWriteScope — validates a proposed write path against manifest.files[].
 *
 * Rules:
 *  1. Resolve the path to an absolute path relative to projectPath.
 *  2. Check it appears in manifest.context.files with purpose 'modify' | 'create'.
 *  3. For docs sessions: additionally verify it starts with <project_path>/docs.
 *  4. If any check fails: log to scope_violations, return errorMessage.
 *
 * @param rawPath       Path string received from the agent (may be relative).
 * @param manifest      The session manifest.
 * @param docsOnly      Set true for fs_write_docs_only tool calls.
 */
export function checkWriteScope(
  rawPath:   string,
  manifest:  TaskManifest,
  docsOnly:  boolean = false
): WriteCheckResult {
  const projectPath = manifest.context.project_path;
  const resolved    = path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(projectPath, rawPath);

  const normalised = resolved.replace(/\\/g, '/');

  // Build allowed set from manifest.files[] (modify + create)
  const allowedPaths = manifest.context.files
    .filter((f) => f.purpose === 'modify' || f.purpose === 'create')
    .map((f) =>
      (path.isAbsolute(f.path) ? f.path : path.resolve(projectPath, f.path)).replace(/\\/g, '/')
    );

  const inManifest = allowedPaths.some((ap) => normalised === ap || normalised.startsWith(ap + '/'));

  if (!inManifest) {
    logScopeViolation({
      manifest_id:    manifest.manifest_id,
      attempted_path: rawPath,
      resolved_path:  resolved,
      session_type:   manifest.task.type,
    });
    return {
      allowed: false,
      errorMessage:
        `Write to "${rawPath}" rejected. This path is not in the manifest files list. ` +
        `Modify only the files specified in the manifest.`,
    };
  }

  // docs-only additional check
  if (docsOnly) {
    const docsRoot = path.join(projectPath, 'docs').replace(/\\/g, '/');
    if (!normalised.startsWith(docsRoot + '/') && normalised !== docsRoot) {
      logScopeViolation({
        manifest_id:    manifest.manifest_id,
        attempted_path: rawPath,
        resolved_path:  resolved,
        session_type:   manifest.task.type,
      });
      return {
        allowed: false,
        errorMessage:
          `Write to "${rawPath}" rejected. Documentation sessions may only write inside the /docs directory.`,
      };
    }
  }

  return { allowed: true };
}
