/**
 * PATCH /api/portfolio/archive/[id]
 * Body: { verified: true }  — marks archive as verified by user.
 *
 * DELETE /api/portfolio/archive/[id]
 * Permanently deletes the archived directory.
 * GUARD: verified_by_user MUST be 1 or request is rejected.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';
import fs from 'fs';

interface ArchiveRow {
  id: string;
  project_id: string;
  archive_path: string;
  verified_by_user: number;
  deleted_at: number | null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json() as { verified?: boolean };

    if (!body.verified) {
      return NextResponse.json({ success: false, error: 'verified must be true' }, { status: 400 });
    }

    const db = getDatabase();
    const result = db.prepare(
      `UPDATE portfolio_archives SET verified_by_user = 1 WHERE id = ? AND deleted_at IS NULL`
    ).run(id);

    if (result.changes === 0) {
      return NextResponse.json({ success: false, error: 'Archive not found or already deleted' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const db = getDatabase();

    const row = db.prepare(
      `SELECT id, project_id, archive_path, verified_by_user, deleted_at FROM portfolio_archives WHERE id = ?`
    ).get(id) as ArchiveRow | undefined;

    if (!row) {
      return NextResponse.json({ success: false, error: 'Archive not found' }, { status: 404 });
    }
    if (row.deleted_at !== null) {
      return NextResponse.json({ success: false, error: 'Archive already deleted' }, { status: 409 });
    }

    // GUARD: must be verified before deletion — no exceptions
    if (row.verified_by_user !== 1) {
      return NextResponse.json(
        { success: false, error: 'Archive must be verified by user before deletion' },
        { status: 403 }
      );
    }

    // Delete from filesystem
    try {
      if (fs.existsSync(row.archive_path)) {
        fs.rmSync(row.archive_path, { recursive: true, force: true });
      }
    } catch (fsErr) {
      const msg = fsErr instanceof Error ? fsErr.message : String(fsErr);
      return NextResponse.json({ success: false, error: `Filesystem deletion failed: ${msg}` }, { status: 500 });
    }

    // Mark as deleted in DB (never actually delete the record — audit trail)
    db.prepare(`UPDATE portfolio_archives SET deleted_at = ? WHERE id = ?`).run(Date.now(), id);

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/portfolio/archive/[id]] DELETE error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
