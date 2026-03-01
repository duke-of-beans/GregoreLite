import { nanoid } from 'nanoid';
import { getDatabase } from './database';
import type { Project, CreateProjectInput } from './types';

// ─── Project operations ──────────────────────────────────────────────────────

export function createProject(input: CreateProjectInput): Project {
  const db = getDatabase();
  const id = nanoid();
  const now = Date.now();
  const meta = input.meta ? JSON.stringify(input.meta) : null;

  db.prepare(`
    INSERT INTO projects (id, name, path, description, status, created_at, updated_at, meta)
    VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
  `).run(id, input.name, input.path ?? null, input.description ?? null, now, now, meta);

  return getProject(id)!;
}

export function getProject(id: string): Project | null {
  const db = getDatabase();
  return (db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project) ?? null;
}

export function listProjects(status?: Project['status']): Project[] {
  const db = getDatabase();
  if (status) {
    return db.prepare(
      'SELECT * FROM projects WHERE status = ? ORDER BY updated_at DESC'
    ).all(status) as Project[];
  }
  return db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as Project[];
}

/** Returns the most recently active project, or null if none exist. */
export function getActiveProject(): Project | null {
  const db = getDatabase();
  return (
    db.prepare(
      "SELECT * FROM projects WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1"
    ).get() as Project
  ) ?? null;
}

export function upsertProject(id: string, name: string, path?: string): Project {
  const db = getDatabase();
  const now = Date.now();
  db.prepare(`
    INSERT INTO projects (id, name, path, status, created_at, updated_at)
    VALUES (?, ?, ?, 'active', ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      path = COALESCE(excluded.path, path),
      updated_at = excluded.updated_at
  `).run(id, name, path ?? null, now, now);
  return getProject(id)!;
}

export function touchProject(id: string): void {
  const db = getDatabase();
  db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(Date.now(), id);
}
