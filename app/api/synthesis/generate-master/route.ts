/**
 * POST /api/synthesis/generate-master
 * Manually trigger master synthesis generation.
 * For users who want it before adding all sources.
 * Sprint 28.0
 */

import { NextResponse } from 'next/server';
import { getOrchestrator } from '@/lib/synthesis/orchestrator';

export async function POST(): Promise<NextResponse> {
  try {
    const synthesis = await getOrchestrator().generateMasterNow();
    return NextResponse.json({ synthesis });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/synthesis/generate-master] Error:', message);
    return NextResponse.json(
      { error: `Master synthesis failed: ${message}` },
      { status: 500 },
    );
  }
}
