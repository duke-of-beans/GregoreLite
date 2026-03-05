/**
 * AEGIS Health Check API — Sprint S9-13
 *
 * GET /api/aegis/health → { data: { alive: boolean } }
 * Proxies to AEGIS status server's /health endpoint.
 */

import { NextResponse } from 'next/server';
import { checkHealth } from '@/lib/aegis/client';
import { safeHandler } from '@/lib/api/utils';

export const GET = safeHandler(async () => {
  const alive = await checkHealth();
  return NextResponse.json({ data: { alive } });
});
