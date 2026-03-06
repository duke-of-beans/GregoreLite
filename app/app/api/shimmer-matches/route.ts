import { NextRequest, NextResponse } from 'next/server';
import { queryShimmerMatches } from '@/lib/memory/shimmer-query';

/**
 * POST /api/shimmer-matches
 * Body: { input: string; conversationId: string }
 * Returns: { matches: ShimmerMatch[] }
 *
 * Called by useShimmerMatches hook (debounced 300ms).
 * Budget: <50ms — if KERNL FTS5 is unavailable, returns empty matches.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { input?: string; conversationId?: string };
    const input = typeof body.input === 'string' ? body.input : '';
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId : '';

    const matches = queryShimmerMatches(input, conversationId);
    return NextResponse.json({ matches });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[shimmer-matches] Error:', msg);
    // Fail open — return empty matches so UI degrades gracefully
    return NextResponse.json({ matches: [] });
  }
}
