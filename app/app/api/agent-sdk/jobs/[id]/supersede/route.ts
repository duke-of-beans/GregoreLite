/**
 * POST /api/agent-sdk/jobs/[id]/supersede
 *
 * Marks a job as superseded by a new job (Edit & Retry flow).
 * Sets status = 'superseded' and stores pointer to replacement job.
 *
 * Sprint S9-11 — Job Retry / Edit Manifest
 */

import { NextRequest, NextResponse } from 'next/server';
import { markSuperseded } from '@/lib/agent-sdk/job-tracker';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json() as { replacedByManifestId?: string };

    if (!body.replacedByManifestId) {
      return NextResponse.json(
        { error: 'replacedByManifestId is required' },
        { status: 400 },
      );
    }

    markSuperseded(id, body.replacedByManifestId);

    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
