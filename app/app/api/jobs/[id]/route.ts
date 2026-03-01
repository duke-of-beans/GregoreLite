/**
 * /api/jobs/[id]
 *
 * GET    — get status of a specific job
 * DELETE — kill a running job → INTERRUPTED
 */

import { NextRequest, NextResponse } from 'next/server';
import { status, kill } from '@/lib/agent-sdk';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const job = status(id);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }
  return NextResponse.json({ data: job });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const killed = kill(id);
  if (!killed) {
    return NextResponse.json({ error: 'Job not found or already complete' }, { status: 404 });
  }
  return NextResponse.json({ data: { killed: true } });
}
