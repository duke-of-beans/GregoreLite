/**
 * POST /api/projects/switch
 * S9-19 — Switch active project by touching its updated_at timestamp.
 * Body: { projectId: string }
 * After switch, triggers bootstrap context reload on next poll.
 */

import { NextResponse } from 'next/server';
import { touchProject, getProject } from '@/lib/kernl';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { projectId?: string };
    if (!body.projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    const project = getProject(body.projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Touch updated_at so getActiveProject() picks this one up
    touchProject(body.projectId);

    return NextResponse.json({ data: { switched: true, projectId: body.projectId, name: project.name } });
  } catch (err) {
    console.error('[projects/switch] POST failed:', err);
    return NextResponse.json({ error: 'Failed to switch project' }, { status: 500 });
  }
}