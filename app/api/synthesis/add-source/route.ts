/**
 * POST /api/synthesis/add-source
 * Registers and starts indexing a new source.
 * Body: { type: IndexingSourceType, pathOrConfig?: string, label?: string }
 * Sprint 28.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOrchestrator } from '@/lib/synthesis/orchestrator';
import type { IndexingSourceType } from '@/lib/synthesis/types';

const VALID_TYPES: IndexingSourceType[] = [
  'local_files',
  'projects',
  'email',
  'conversations',
  'calendar',
  'notes',
  'custom',
];

const AddSourceSchema = z.object({
  type:          z.enum(VALID_TYPES as [IndexingSourceType, ...IndexingSourceType[]]),
  pathOrConfig:  z.string().nullable().optional(),
  label:         z.string().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = AddSourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const { type, pathOrConfig, label } = parsed.data;
    const orchestrator = getOrchestrator();
    const source = orchestrator.addSource(type, pathOrConfig ?? null, label);

    // Immediately mark as indexing so the UI shows the right state
    orchestrator.startIndexing(source.id);

    return NextResponse.json({ source }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/synthesis/add-source] Error:', message);
    return NextResponse.json(
      { error: `Failed to add source: ${message}` },
      { status: 500 },
    );
  }
}
