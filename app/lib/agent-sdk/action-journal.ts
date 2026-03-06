/**
 * action-journal.ts — Agent Action Journal — Sprint 19.0
 *
 * Law 3 (Reversibility): every agent tool execution that mutates state gets
 * a journal entry BEFORE execution with enough information to undo it.
 *
 * Undo semantics:
 *   file_write  — restore before_state (or delete the file if it was new)
 *   file_delete — not currently issued by agent tools; marked reversible=false
 *   command     — logged but not undoable; reversible=false
 *   git_commit  — store commit hash; undo = git revert (reversible=false for safety)
 *
 * All writes go to the `action_journal` SQLite table.
 * Table is created by runMigrations() in kernl/database.ts.
 *
 * BLUEPRINT §Law 3 (Sacred Laws), SPRINT_19_0_BRIEF.md Task 1
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getDatabase } from '../kernl/database';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionType = 'file_write' | 'file_delete' | 'command' | 'git_commit';

export interface ActionJournalEntry {
  id: string;
  session_id: string;
  tool_name: string;
  action_type: ActionType;
  target_path?: string;
  before_state?: string | null; // file contents before write; null = file was new
  after_state?: string | null;  // file contents after write
  command?: string;             // for run_command / git_commit
  reversible: boolean;          // false for truly irreversible actions
  undone: boolean;
  created_at: number;
}

export interface UndoResult {
  success: boolean;
  message: string;
}

// ─── Row shape ────────────────────────────────────────────────────────────────

interface JournalRow {
  id: string;
  session_id: string;
  tool_name: string;
  action_type: string;
  target_path: string | null;
  before_state: string | null;
  after_state: string | null;
  command: string | null;
  reversible: number; // SQLite stores booleans as integers
  undone: number;
  created_at: number;
}

function rowToEntry(row: JournalRow): ActionJournalEntry {
  return {
    id: row.id,
    session_id: row.session_id,
    tool_name: row.tool_name,
    action_type: row.action_type as ActionType,
    ...(row.target_path !== null ? { target_path: row.target_path } : {}),
    ...(row.before_state !== null ? { before_state: row.before_state } : {}),
    ...(row.after_state !== null ? { after_state: row.after_state } : {}),
    ...(row.command !== null ? { command: row.command } : {}),
    reversible: row.reversible === 1,
    undone: row.undone === 1,
    created_at: row.created_at,
  };
}

// ─── Write helpers ────────────────────────────────────────────────────────────

function insertEntry(entry: Omit<ActionJournalEntry, 'id'> & { id: string }): void {
  try {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO action_journal (
        id, session_id, tool_name, action_type,
        target_path, before_state, after_state, command,
        reversible, undone, created_at
      ) VALUES (
        @id, @session_id, @tool_name, @action_type,
        @target_path, @before_state, @after_state, @command,
        @reversible, @undone, @created_at
      )
    `).run({
      id: entry.id,
      session_id: entry.session_id,
      tool_name: entry.tool_name,
      action_type: entry.action_type,
      target_path: entry.target_path ?? null,
      before_state: entry.before_state ?? null,
      after_state: entry.after_state ?? null,
      command: entry.command ?? null,
      reversible: entry.reversible ? 1 : 0,
      undone: entry.undone ? 1 : 0,
      created_at: entry.created_at,
    });
  } catch (err) {
    // Non-fatal — journal failure must not crash the session
    console.warn('[action-journal] Failed to insert entry:', err instanceof Error ? err.message : String(err));
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * journalBeforeWrite — capture before_state of a file, create journal entry.
 * Must be called BEFORE the file write happens.
 * Returns the entry ID for use with journalAfterWrite().
 *
 * before_state is null when the file does not yet exist (new file).
 * Undo of a new file = delete the file.
 */
export function journalBeforeWrite(sessionId: string, filePath: string, toolName: string = 'fs_write'): string {
  const id = randomUUID();
  let beforeState: string | null = null;

  try {
    const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
    if (fs.existsSync(resolved)) {
      beforeState = fs.readFileSync(resolved, 'utf8');
    }
  } catch {
    // If we can't read the file, treat as new (before_state = null)
    beforeState = null;
  }

  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);

  insertEntry({
    id,
    session_id: sessionId,
    tool_name: toolName,
    action_type: 'file_write',
    target_path: resolved,
    before_state: beforeState,
    after_state: null,    // filled in by journalAfterWrite
    reversible: true,     // file writes are always reversible
    undone: false,
    created_at: Date.now(),
  });

  return id;
}

/**
 * journalAfterWrite — capture after_state once the write is complete.
 * Call immediately after the fs.writeFileSync succeeds.
 */
export function journalAfterWrite(entryId: string, filePath: string): void {
  try {
    const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
    const afterState = fs.existsSync(resolved) ? fs.readFileSync(resolved, 'utf8') : null;

    const db = getDatabase();
    db.prepare(`
      UPDATE action_journal SET after_state = ? WHERE id = ?
    `).run(afterState, entryId);
  } catch (err) {
    console.warn('[action-journal] Failed to update after_state:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * journalCommand — log a run_command or git_commit action.
 * Commands are not undoable (reversible=false).
 * For git_commit, pass the commit hash in afterState.
 */
export function journalCommand(
  sessionId: string,
  command: string,
  toolName: string = 'run_command',
  afterState?: string,
): string {
  const id = randomUUID();
  const isGit = toolName === 'git_commit';

  insertEntry({
    id,
    session_id: sessionId,
    tool_name: toolName,
    action_type: isGit ? 'git_commit' : 'command',
    before_state: null,
    after_state: afterState ?? null,
    command,
    reversible: false,  // commands generally not undoable
    undone: false,
    created_at: Date.now(),
  });

  return id;
}

/**
 * undoAction — restore before_state for file_write actions.
 * For new files (before_state === null), deletes the file.
 * Returns UndoResult indicating success or failure.
 */
export function undoAction(entryId: string): UndoResult {
  let row: JournalRow | undefined;

  try {
    const db = getDatabase();
    row = db.prepare(`SELECT * FROM action_journal WHERE id = ?`).get(entryId) as JournalRow | undefined;
  } catch (err) {
    return { success: false, message: `DB error: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (!row) {
    return { success: false, message: `Entry ${entryId} not found.` };
  }
  if (row.undone === 1) {
    return { success: false, message: 'This action has already been undone.' };
  }
  if (row.reversible === 0) {
    return { success: false, message: 'This action cannot be undone.' };
  }
  if (row.action_type !== 'file_write' || !row.target_path) {
    return { success: false, message: 'Only file writes can be undone.' };
  }

  try {
    const filePath = row.target_path;

    if (row.before_state === null) {
      // File was new — undo by deleting it
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } else {
      // File existed before — restore contents
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, row.before_state, 'utf8');
    }

    // Mark as undone in DB
    const db = getDatabase();
    db.prepare(`UPDATE action_journal SET undone = 1 WHERE id = ?`).run(entryId);

    const desc = row.before_state === null
      ? `Deleted new file ${path.basename(filePath)}`
      : `Restored ${path.basename(filePath)} to before-write state`;

    return { success: true, message: desc };
  } catch (err) {
    return { success: false, message: `Undo failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * getSessionActions — list all journal entries for a session, newest first.
 */
export function getSessionActions(sessionId: string): ActionJournalEntry[] {
  try {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM action_journal
      WHERE session_id = ?
      ORDER BY created_at DESC
    `).all(sessionId) as JournalRow[];
    return rows.map(rowToEntry);
  } catch {
    return [];
  }
}
