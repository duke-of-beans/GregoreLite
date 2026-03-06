import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';

// POST /api/portfolio/mute
// Body: { projectId: string; hours: number }
// Sets attention_muted_until on the project row.
// hours = 0 clears the mute.
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = (await req.json()) as {
      projectId?: string;
      hours?: number;
    };

    const projectId = (body.projectId ?? '').trim();
    const hours = Number(body.hours ?? 0);

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId required' },
        { status: 400 },
      );
    }

    if (!Number.isFinite(hours) || hours < 0) {
      return NextResponse.json(
        { success: false, error: 'hours must be a non-negative number' },
        { status: 400 },
      );
    }

    const db = getDatabase();

    const mutedUntil =
      hours === 0 ? null : Date.now() + hours * 60 * 60 * 1000;

    const result = db
      .prepare(
        `UPDATE portfolio_projects
            SET attention_muted_until = ?
          WHERE id = ?`,
      )
      .run(mutedUntil, projectId);

    if (result.changes === 0) {
      return NextResponse.json(
        { success: false, error: 'project not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { projectId, mutedUntil },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
