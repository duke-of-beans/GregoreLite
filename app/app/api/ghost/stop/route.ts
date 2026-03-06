/**
 * Ghost Stop API — Sprint 20.0
 *
 * POST /api/ghost/stop — stops the Ghost Thread (all components).
 *
 * Called by:
 *   - page.tsx beforeunload via navigator.sendBeacon (dev mode + Tauri)
 *   - GhostSection master toggle when user turns Ghost off
 *
 * stopGhost() in lifecycle.ts enforces a 5-second hard timeout and handles
 * partial failures gracefully — this route never throws.
 */

import { NextResponse } from 'next/server';
import { stopGhost } from '@/lib/ghost';
import { safeHandler } from '@/lib/api/utils';

export const POST = safeHandler(async () => {
  await stopGhost();
  return NextResponse.json({ stopped: true });
});
