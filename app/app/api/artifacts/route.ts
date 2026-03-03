/**
 * Artifacts API — Sprint S9-17
 *
 * GET /api/artifacts — Browse artifacts with filters, pagination, search
 * Query params: project, type, language, dateFrom, dateTo, search, page, pageSize
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';

interface ArtifactRow {
  id: string;
  thread_id: string | null;
  project_id: string | null;
  type: string;
  title: string;
  content: string;
  language: string | null;
  file_path: string | null;
  created_at: number;
  meta: string | null;
  project_name: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const db = getDatabase();
    const url = req.nextUrl;

    const project = url.searchParams.get('project');
    const type = url.searchParams.get('type');
    const language = url.searchParams.get('language');
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');
    const search = url.searchParams.get('search');
    const page = parseInt(url.searchParams.get('page') ?? '1', 10);
    const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') ?? '50', 10), 100);

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (project) { conditions.push('a.project_id = ?'); params.push(project); }
    if (type) { conditions.push('a.type = ?'); params.push(type); }
    if (language) { conditions.push('a.language = ?'); params.push(language); }
    if (dateFrom) { conditions.push('a.created_at >= ?'); params.push(parseInt(dateFrom, 10)); }
    if (dateTo) { conditions.push('a.created_at <= ?'); params.push(parseInt(dateTo, 10)); }
    if (search && search.trim()) { conditions.push('a.title LIKE ?'); params.push(`%${search.trim()}%`); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM artifacts a ${where}`).get(...params) as { total: number };
    const total = countRow.total;

    const offset = (page - 1) * pageSize;
    const rows = db.prepare(`
      SELECT a.*, p.name as project_name
      FROM artifacts a
      LEFT JOIN projects p ON a.project_id = p.id
      ${where}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset) as ArtifactRow[];

    // Filter options
    const types = (db.prepare('SELECT DISTINCT type FROM artifacts ORDER BY type').all() as Array<{ type: string }>).map((r) => r.type);
    const languages = (db.prepare('SELECT DISTINCT language FROM artifacts WHERE language IS NOT NULL ORDER BY language').all() as Array<{ language: string }>).map((r) => r.language);
    const projects = db.prepare('SELECT DISTINCT p.id, p.name FROM artifacts a JOIN projects p ON a.project_id = p.id ORDER BY p.name').all() as Array<{ id: string; name: string }>;

    return NextResponse.json({
      data: {
        items: rows.map((r) => ({
          id: r.id,
          thread_id: r.thread_id,
          project_id: r.project_id,
          type: r.type,
          title: r.title,
          language: r.language,
          file_path: r.file_path,
          created_at: r.created_at,
          project_name: r.project_name,
          // Don't send full content in list view — too large
          contentPreview: r.content.slice(0, 200),
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        filters: { types, languages, projects },
      },
    });
  } catch (err) {
    console.error('[artifacts] GET failed:', err);
    return NextResponse.json({ error: 'Failed to load artifacts' }, { status: 500 });
  }
}