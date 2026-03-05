/**
 * Ghost Status API
 * Sprint 6G
 *
 * GET /api/ghost/status — returns current GhostStatus snapshot
 */

import { NextResponse } from 'next/server';
import { getGhostStatus } from '@/lib/ghost';
import { safeHandler } from '@/lib/api/utils';

export const GET = safeHandler(async () => {
  const status = getGhostStatus();
  return NextResponse.json(status);
});
