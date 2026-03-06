/**
 * AEGIS Health Check API — Sprint 16.0
 *
 * GET /api/aegis/health → { data: { alive: boolean } }
 *
 * Sprint 16.0: AEGIS is now embedded via Tauri IPC. The health check
 * returns based on whether we're running inside Tauri (always true)
 * or in dev mode (always false). No more HTTP proxy to port 8743.
 */

import { NextResponse } from 'next/server';
import { isTauriAvailable } from '@/lib/aegis/client';
import { safeHandler } from '@/lib/api/utils';

export const GET = safeHandler(async () => {
  // In SSR context (Next.js API route), Tauri is never available.
  // The real health check happens client-side via IPC.
  // This route exists for backward compatibility only.
  let alive = false;
  try {
    alive = await isTauriAvailable();
  } catch {
    alive = false;
  }
  return NextResponse.json({ data: { alive } });
});
