/**
 * GET /api/synthesis/status
 * Returns all indexing sources with their status and synthesis text.
 * Sprint 28.0
 */

import { NextResponse } from 'next/server';
import { getOrchestrator } from '@/lib/synthesis/orchestrator';

export async function GET(): Promise<NextResponse> {
  try {
    const progress = getOrchestrator().getProgress();
    return NextResponse.json(progress);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/synthesis/status] Error:', message);
    return NextResponse.json(
      { error: `Failed to get synthesis status: ${message}` },
      { status: 500 },
    );
  }
}
