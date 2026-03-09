/**
 * Portfolio API — Single Project
 * Sprint 24.0
 *
 * GET /api/portfolio/[id] — returns one project with full scan_data
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';
import { scanSingleProject } from '@/lib/portfolio/scanner';
import type { PortfolioProject, PortfolioScanData, PatchProjectBody, DeleteProjectBody } from '@/lib/portfolio/types';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const db = getDatabase();

  const row = db.prepare(`
    SELECT id, name, path, type, type_label, status, registered_at, last_scanned_at, scan_data
    FROM portfolio_projects WHERE id = ?
  `).get(id) as PortfolioProject | undefined;

  if (!row) {
    return NextResponse.json({ success: false, error: 'Project not found', timestamp: new Date().toISOString() }, { status: 404 });
  }

  const scanData: PortfolioScanData | null = row.scan_data
    ? (JSON.parse(row.scan_data) as PortfolioScanData)
    : null;

  // Trigger a fresh scan for this project in the background
  void Promise.resolve().then(() => {
    try {
      scanSingleProject(row.path);
    } catch { /* silent */ }
  });

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    data: {
      id: row.id,
      name: row.name,
      path: row.path,
      type: row.type,
      typeLabel: row.type_label ?? row.type,
      status: row.status,
      registeredAt: row.registered_at,
      lastScannedAt: row.last_scanned_at,
      scanData,
    },
  });
}

// ── PATCH /api/portfolio/[id] — rename / retype / restate ────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  let body: PatchProjectBody;
  try {
    body = await request.json() as PatchProjectBody;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const db = getDatabase();
  const row = db.prepare('SELECT id FROM portfolio_projects WHERE id = ?').get(id) as { id: string } | undefined;
  if (!row) {
    return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
  }

  const updates: string[] = [];
  const args: unknown[] = [];
  if (body.name !== undefined) { updates.push('name = ?'); args.push(body.name.trim()); }
  if (body.type !== undefined) { updates.push('type = ?'); args.push(body.type); }
  if (body.status !== undefined) { updates.push('status = ?'); args.push(body.status); }

  if (updates.length === 0) {
    return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
  }

  args.push(id);
  db.prepare(`UPDATE portfolio_projects SET ${updates.join(', ')} WHERE id = ?`).run(...(args as Parameters<ReturnType<typeof db.prepare>['run']>));

  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), data: { id } });
}

// ── DELETE /api/portfolio/[id] — remove project, optionally add to exclusions ─

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  let body: DeleteProjectBody = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as DeleteProjectBody;
  } catch {
    // Body is optional for DELETE
  }

  const db = getDatabase();
  const row = db.prepare('SELECT id, path FROM portfolio_projects WHERE id = ?').get(id) as { id: string; path: string } | undefined;
  if (!row) {
    return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
  }

  // Optionally exclude path so scanner never re-adds it
  if (body.exclude) {
    try {
      db.prepare(`
        INSERT OR REPLACE INTO portfolio_exclusions (path, excluded_at, reason)
        VALUES (?, ?, ?)
      `).run(row.path, Date.now(), body.reason ?? 'User removed');
    } catch {
      // portfolio_exclusions may not be available yet — safe to continue
    }
  }

  db.prepare('DELETE FROM portfolio_projects WHERE id = ?').run(id);

  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), data: { id } });
}
