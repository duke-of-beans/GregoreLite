/**
 * GET /api/portfolio/archive
 * Query: ?projectId=<id>  (optional — omit for all archives)
 * Returns list of portfolio_archives rows with verification status.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';

interface ArchiveRow {
  id: string;
  project_id: string;
  original_path: string;
  archive_path: string;
  archived_at: number;
  verified_by_user: number;
  deleted_at: number | null;
}

interface ProjectRow {
  name: string;
}

export async function GET(req: NextRequest) {
  try {
    const db = getDatabase();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    let rows: ArchiveRow[];
    if (projectId) {
      rows = db.prepare(
        `SELECT * FROM portfolio_archives WHERE project_id = ? ORDER BY archived_at DESC`
      ).all(projectId) as ArchiveRow[];
    } else {
      rows = db.prepare(
        `SELECT * FROM portfolio_archives ORDER BY archived_at DESC`
      ).all() as ArchiveRow[];
    }

    // Enrich with project name
    const data = rows.map((row) => {
      const proj = db.prepare('SELECT name FROM portfolio_projects WHERE id = ?').get(row.project_id) as ProjectRow | undefined;
      return {
        id: row.id,
        projectId: row.project_id,
        projectName: proj?.name ?? row.project_id,
        originalPath: row.original_path,
        archivePath: row.archive_path,
        archivedAt: row.archived_at,
        verifiedByUser: row.verified_by_user === 1,
        deletedAt: row.deleted_at,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
