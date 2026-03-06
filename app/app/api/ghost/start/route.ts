/**
 * Ghost Start API — Sprint 20.0
 *
 * POST /api/ghost/start — starts (or restarts) the Ghost Thread.
 *
 * Called by GhostSection master toggle when user turns Ghost on.
 * startGhost() in lifecycle.ts is idempotent — safe to call multiple times.
 * After a stopGhost(), calling startGhost() re-initialises all components.
 */

import { NextResponse } from 'next/server';
import { startGhost } from '@/lib/ghost';
import { safeHandler } from '@/lib/api/utils';

export const POST = safeHandler(async () => {
  await startGhost();
  return NextResponse.json({ started: true });
});
