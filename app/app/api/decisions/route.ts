/**
 * Decisions API — Sprint S9-16
 *
 * GET /api/decisions — Browse decisions with filters, pagination, full-text search
 * Query params: project, category, impact, dateFrom, dateTo, search, page, pageSize
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';

interface DecisionRow {
  id: string;
  thread_id: string | null;
  category: string;
  title: string;
  rationale: string;
  alternatives: string | null;
  impact: string | null;
  created_at: number;
  meta: string | null;
  project_id: string | null;
  project_name: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const db = getDatabase();
    const url = req.nextUrl;

    const project = url.searchParams.get('project');
    const category = url.searchParams.get('category');
    const impact = url.searchParams.get('impact');
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');
    const search = url.searchParams.get('search');
    const page = parseInt(url.searchParams.get('page') ?? '1', 10);
    const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') ?? '50', 10), 100);

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (project) {
      conditions.push('t.project_id = ?');
      params.push(project);
    }
    if (category) {
      conditions.push('d.category = ?');
      params.push(category);
    }
    if (impact) {
      conditions.push('d.impact = ?');
      params.push(impact);
    }
    if (dateFrom) {
      conditions.push('d.created_at >= ?');
      params.push(parseInt(dateFrom, 10));
    }
    if (dateTo) {
      conditions.push('d.created_at <= ?');
      params.push(parseInt(dateTo, 10));
    }

    // Full-text search via FTS5
    let ftsJoin = '';
    if (search && search.trim()) {
      ftsJoin = 'INNER JOIN decisions_fts fts ON fts.rowid = d.rowid';
      conditions.push('decisions_fts MATCH ?');
      params.push(search.trim());
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countSql = `SELECT COUNT(*) as total FROM decisions d LEFT JOIN threads t ON d.thread_id = t.id ${ftsJoin} ${where}`;
    const countRow = db.prepare(countSql).get(...params) as { total: number };
    const total = countRow.total;

    // Fetch page
    const offset = (page - 1) * pageSize;
    const dataSql = `
      SELECT d.*, t.project_id, p.name as project_name
      FROM decisions d
      LEFT JOIN threads t ON d.thread_id = t.id
      LEFT JOIN projects p ON t.project_id = p.id
      ${ftsJoin}
      ${where}
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const rows = db.prepare(dataSql).all(...params, pageSize, offset) as DecisionRow[];

    // Get available categories and projects for filter dropdowns
    const categories = (db.prepare('SELECT DISTINCT category FROM decisions ORDER BY category').all() as Array<{ category: string }>).map((r) => r.category);
    const projects = db.prepare('SELECT DISTINCT p.id, p.name FROM decisions d JOIN threads t ON d.thread_id = t.id JOIN projects p ON t.project_id = p.id ORDER BY p.name').all() as Array<{ id: string; name: string }>;

    return NextResponse.json({
      data: {
        items: rows.map((r) => ({
          ...r,
          alternatives: r.alternatives ? JSON.parse(r.alternatives) : [],
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        filters: { categories, projects },
      },
    });
  } catch (err) {
    console.error('[decisions] GET failed:', err);
    return NextResponse.json({ error: 'Failed to load decisions' }, { status: 500 });
  }
}
