/**
 * POST /api/aegis/override
 *
 * Manual AEGIS profile override from status bar.
 * Bypasses anti-flap, logs is_override=1 in KERNL.
 *
 * Body: { profile: WorkloadProfile, sourceThread?: string }
 * Response: { success: true, profile: string }
 */

import { NextResponse } from 'next/server';
import { overrideAEGISProfile } from '@/lib/aegis';
import { type WorkloadProfile } from '@/lib/aegis';

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await req.json() as { profile: WorkloadProfile; sourceThread?: string };

    if (!body.profile) {
      return NextResponse.json(
        { success: false, error: 'profile is required' },
        { status: 400 },
      );
    }

    await overrideAEGISProfile(body.profile, body.sourceThread);

    return NextResponse.json({ success: true, profile: body.profile });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[api/aegis/override] Error:', error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
