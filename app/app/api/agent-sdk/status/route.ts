/**
 * GET /api/agent-sdk/status
 *
 * Returns API key configuration status for the ApiSection settings component.
 * Sprint 10.9 Task 9 — created to fix 404 in settings panel.
 */

import { NextResponse } from 'next/server';
import { safeHandler } from '@/lib/api/utils';

export const GET = safeHandler(async () => {
  const apiKeyConfigured = !!process.env.ANTHROPIC_API_KEY;

  return NextResponse.json({
    success: true,
    data: {
      apiKeyConfigured,
      version: process.env.npm_package_version ?? 'unknown',
    },
  });
});
