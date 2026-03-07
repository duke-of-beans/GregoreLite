/**
 * Capture Promote — Sprint 29.0
 *
 * promoteToBacklog: writes a capture note to the correct project backlog file.
 * Determines target file based on project type from portfolio_projects.
 * Appends formatted markdown item to the target file.
 */

import fs from 'fs';
import path from 'path';
import { getDatabase } from '@/lib/kernl/database';
import type { CaptureNote, CaptureClassification } from './types';

// ── Target file resolution ────────────────────────────────────────────────────

const FILE_MAP: Record<string, string> = {
  code:     'FEATURE_BACKLOG.md',
  research: 'RESEARCH_LOG.md',
  business: 'TASK_LIST.md',
  creative: 'TASK_LIST.md',
  custom:   'TASK_LIST.md',
};

const MILESTONE_PROJECTS = ['business']; // also check MILESTONES.md for business

export function resolveTargetFile(projectPath: string, projectType: string): string {
  const fileName = FILE_MAP[projectType] ?? 'TASK_LIST.md';

  // Business projects: prefer MILESTONES.md if it exists
  if (MILESTONE_PROJECTS.includes(projectType)) {
    const milestonesPath = path.join(projectPath, 'MILESTONES.md');
    if (fs.existsSync(milestonesPath)) return milestonesPath;
  }

  return path.join(projectPath, fileName);
}

// ── Backlog item formatting ───────────────────────────────────────────────────

export function formatBacklogItem(note: CaptureNote): string {
  const date = new Date(note.created_at).toISOString().split('T')[0];
  const mentionSuffix =
    note.mention_count > 1 ? `, mentioned ${note.mention_count}x` : '';

  const prefixMap: Record<CaptureClassification, string> = {
    bug:      '**BUG:**',
    feature:  '**FEATURE:**',
    question: '**QUESTION:**',
    idea:     '**IDEA:**',
  };

  const prefix = prefixMap[note.classification];
  const countPart = note.classification !== 'question' ? mentionSuffix : '';
  return `- [ ] ${prefix} ${note.parsed_body} (captured ${date}${countPart})`;
}

function ensureFileWithHeader(filePath: string, projectName: string): void {
  if (fs.existsSync(filePath)) return;

  const fileName = path.basename(filePath, '.md');
  const header = `# ${fileName.replace(/_/g, ' ')}\n\n_${projectName} — created by Quick Capture_\n\n`;
  fs.writeFileSync(filePath, header, 'utf8');
}

// ── Exported API ──────────────────────────────────────────────────────────────

export interface PromoteResult {
  success: boolean;
  filePath: string;
  error?: string;
}

/**
 * Promote a capture note to the appropriate project backlog file.
 * Appends a formatted markdown task item.
 * Updates the note's status to 'backlogged' in the database.
 */
export async function promoteToBacklog(noteId: string): Promise<PromoteResult> {
  const db = getDatabase();

  const note = db
    .prepare(`SELECT * FROM capture_notes WHERE id = ?`)
    .get(noteId) as CaptureNote | undefined;

  if (!note) {
    return { success: false, filePath: '', error: `Note ${noteId} not found` };
  }

  // Resolve target project
  let projectPath: string;
  let projectType: string;
  let projectName: string;

  if (note.project_id) {
    const project = db
      .prepare(`SELECT path, type, name FROM portfolio_projects WHERE id = ?`)
      .get(note.project_id) as { path: string; type: string; name: string } | undefined;

    if (!project) {
      return { success: false, filePath: '', error: `Project ${note.project_id} not found` };
    }
    projectPath = project.path;
    projectType = project.type;
    projectName = project.name;
  } else {
    // Unrouted note — use a default capture file in the GregLite project root
    projectPath = process.env.GREGLITE_ROOT ?? process.cwd();
    projectType = 'custom';
    projectName = 'Unrouted';
  }

  const targetFile = resolveTargetFile(projectPath, projectType);

  try {
    ensureFileWithHeader(targetFile, projectName);

    const item = formatBacklogItem(note);
    fs.appendFileSync(targetFile, `\n${item}\n`, 'utf8');

    // Mark as backlogged
    db.prepare(
      `UPDATE capture_notes SET status = 'backlogged', backlog_item_id = ?, last_mentioned_at = ? WHERE id = ?`
    ).run(path.basename(targetFile), Date.now(), noteId);

    return { success: true, filePath: targetFile };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, filePath: targetFile, error: msg };
  }
}
