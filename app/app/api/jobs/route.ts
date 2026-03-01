/**
 * /api/jobs
 *
 * GET  — list all active + queued jobs (returns JobRecord[])
 * POST — spawn a new worker session from a validated manifest
 */

import { NextRequest, NextResponse } from 'next/server';
import { spawn, list } from '@/lib/agent-sdk';
import { validateManifest } from '@/lib/agent-sdk/manifest';
import { ZodError } from 'zod';

export async function GET() {
  try {
    const jobs = list();
    return NextResponse.json({ data: jobs });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const manifest = validateManifest(body);
    const result = spawn(manifest);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid manifest', details: err.errors }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
