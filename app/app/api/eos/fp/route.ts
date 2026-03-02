/**
 * POST /api/eos/fp
 *
 * Records an EoS issue as a false positive (dismissed) or true positive
 * (accepted) via the fp-tracker. Auto-suppression kicks in when a rule's
 * FP rate exceeds 20% over its last 100 occurrences.
 *
 * Body: { ruleId: string, action: 'dismissed' | 'accepted', filePath: string, projectId: string, line?: number }
 */

import { NextResponse } from 'next/server';
import { recordOccurrence } from '@/lib/eos/fp-tracker';

export const dynamic = 'force-dynamic';

interface FPRequest {
  ruleId: string;
  action: 'dismissed' | 'accepted';
  filePath: string;
  projectId: string;
  line?: number;
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await req.json() as Partial<FPRequest>;

    const { ruleId, action, filePath, projectId, line } = body;

    if (!ruleId || !action || !filePath || !projectId) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: ruleId, action, filePath, projectId' },
        { status: 400 },
      );
    }

    if (action !== 'dismissed' && action !== 'accepted') {
      return NextResponse.json(
        { ok: false, error: 'action must be "dismissed" or "accepted"' },
        { status: 400 },
      );
    }

    recordOccurrence({
      projectId,
      ruleId,
      filePath,
      isFP: action === 'dismissed',
      ...(line !== undefined && { line }),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/eos/fp] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to record FP feedback' },
      { status: 500 },
    );
  }
}
