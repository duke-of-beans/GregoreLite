/**
 * Template Store — Sprint 9-07
 *
 * CRUD operations for the manifest_templates table.
 * Templates save ManifestBuilder form state for recurring jobs.
 */

import { nanoid } from 'nanoid';
import { getDatabase } from '@/lib/kernl/database';
import type { TaskType } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ManifestTemplate {
  id: string;
  name: string;
  description: string | null;
  task_type: TaskType;
  title: string;
  template_description: string;
  success_criteria: string[];
  project_path: string;
  use_count: number;
  created_at: number;
  updated_at: number;
}

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  task_type: string;
  title: string;
  template_description: string;
  success_criteria: string;
  project_path: string;
  use_count: number;
  created_at: number;
  updated_at: number;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  task_type: TaskType;
  title: string;
  template_description: string;
  success_criteria: string[];
  project_path: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToTemplate(row: TemplateRow): ManifestTemplate {
  return {
    ...row,
    task_type: row.task_type as TaskType,
    success_criteria: JSON.parse(row.success_criteria) as string[],
  };
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export function getAllTemplates(): ManifestTemplate[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM manifest_templates ORDER BY use_count DESC, updated_at DESC')
    .all() as TemplateRow[];
  return rows.map(rowToTemplate);
}

export function getTemplatesByTaskType(taskType: TaskType): ManifestTemplate[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM manifest_templates WHERE task_type = ? ORDER BY use_count DESC')
    .all(taskType) as TemplateRow[];
  return rows.map(rowToTemplate);
}

export function getRecentTemplates(limit: number = 5): ManifestTemplate[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM manifest_templates ORDER BY use_count DESC, updated_at DESC LIMIT ?')
    .all(limit) as TemplateRow[];
  return rows.map(rowToTemplate);
}

export function getTemplateById(id: string): ManifestTemplate | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT * FROM manifest_templates WHERE id = ?')
    .get(id) as TemplateRow | undefined;
  return row ? rowToTemplate(row) : null;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export function createTemplate(input: CreateTemplateInput): ManifestTemplate {
  const db = getDatabase();
  const id = nanoid();
  const now = Date.now();

  db.prepare(
    `INSERT INTO manifest_templates (id, name, description, task_type, title, template_description, success_criteria, project_path, use_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(
    id,
    input.name,
    input.description ?? null,
    input.task_type,
    input.title,
    input.template_description,
    JSON.stringify(input.success_criteria),
    input.project_path,
    now,
    now,
  );

  return {
    id,
    name: input.name,
    description: input.description ?? null,
    task_type: input.task_type,
    title: input.title,
    template_description: input.template_description,
    success_criteria: input.success_criteria,
    project_path: input.project_path,
    use_count: 0,
    created_at: now,
    updated_at: now,
  };
}

// ─── Update ───────────────────────────────────────────────────────────────────

export function incrementTemplateUseCount(id: string): void {
  const db = getDatabase();
  db.prepare('UPDATE manifest_templates SET use_count = use_count + 1, updated_at = ? WHERE id = ?')
    .run(Date.now(), id);
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function deleteTemplate(id: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM manifest_templates WHERE id = ?').run(id);
}
