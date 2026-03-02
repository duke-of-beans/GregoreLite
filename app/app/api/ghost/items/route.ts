/**
 * Ghost Privacy — Indexed Items API
 * Sprint 6G
 *
 * GET  /api/ghost/items           — paginated list of ghost_indexed_items
 *   Query params: page (default 1), type (all|file|email), search (substring)
 * DELETE /api/ghost/items?id=<id> — cascade delete one item
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';
import { deleteGhostItem } from '@/lib/ghost/privacy';

const PAGE_SIZE = 50;

interface IndexedItemRow {
  id: string;
  source_type: string;
  source_path: string | null;
  source_account: string | null;
  chunk_count: number;
  indexed_at: number;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = req.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get('page') ?? '1'));
  const type = params.get('type') ?? 'all';
  const search = (params.get('search') ?? '').trim();
  const offset = (page - 1) * PAGE_SIZE;

  const db = getDatabase();

  const conditions: string[] = ['deleted = 0'];
  const bindValues: unknown[] = [];

  if (type === 'file' || type === 'email') {
    conditions.push('source_type = ?');
    bindValues.push(type);
  }
  if (search) {
    conditions.push('source_path LIKE ?');
    bindValues.push(`%${search}%`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const countRow = db
    .prepare(`SELECT COUNT(*) AS total FROM ghost_indexed_items ${where}`)
    .get(...bindValues) as { total: number };

  const rows = db
    .prepare(
      `SELECT id, source_type, source_path, source_account, chunk_count, indexed_at
       FROM ghost_indexed_items ${where}
       ORDER BY indexed_at DESC LIMIT ? OFFSET ?`
    )
    .all(...bindValues, PAGE_SIZE, offset) as IndexedItemRow[];

  const fileCt = (
    db.prepare(
      `SELECT COUNT(*) AS c FROM ghost_indexed_items WHERE deleted = 0 AND source_type = 'file'`
    ).get() as { c: number }
  ).c;
  const emailCt = (
    db.prepare(
      `SELECT COUNT(*) AS c FROM ghost_indexed_items WHERE deleted = 0 AND source_type = 'email'`
    ).get() as { c: number }
  ).c;

  return NextResponse.json({
    items: rows,
    total: countRow.total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(countRow.total / PAGE_SIZE),
    summary: { total: fileCt + emailCt, files: fileCt, emails: emailCt },
  });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const deleted = await deleteGhostItem(id);
  if (!deleted) {
    return NextResponse.json(
      { error: 'item not found or already deleted' },
      { status: 404 }
    );
  }

  return new NextResponse(null, { status: 204 });
}
