/**
 * GET /api/synthesis/master
 * Returns the most recent completed master synthesis, or null if not yet done.
 * Sprint 28.0
 */

import { NextResponse } from 'next/server';
import { loadMasterSynthesis } from '@/lib/synthesis/master';

export async function GET(): Promise<NextResponse> {
  try {
    const synthesis = loadMasterSynthesis();
    // synthesis is null if no completed master exists yet — that's a valid state
    return NextResponse.json({ synthesis });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/synthesis/master] Error:', message);
    return NextResponse.json(
      { error: `Failed to load master synthesis: ${message}` },
      { status: 500 },
    );
  }
}
