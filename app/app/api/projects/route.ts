/**
 * GET /api/projects
 * S9-19 — List all active projects for Project Quick-Switcher.
 */

import { NextResponse } from 'next/server';
import { listProjects } from '@/lib/kernl';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const projects = listProjects('active');
    return NextResponse.json({
      data: projects.map((p) => ({
        id: p.id,
        name: p.name,
        path: p.path ?? null,
        status: p.status,
      })),
    });
  } catch (err) {
    console.error('[projects] GET failed:', err);
    return NextResponse.json({ error: 'Failed to list projects' }, { status: 500 });
  }
}