/**
 * Portfolio API — Manual Rescan
 * Sprint 24.0
 *
 * POST /api/portfolio/scan — triggers immediate rescan of all projects.
 */

import { safeHandler, successResponse, errorResponse } from '@/lib/api/utils';
import { scanAllProjects } from '@/lib/portfolio/scanner';

export const POST = safeHandler(async (_request: Request) => {
  try {
    const cards = scanAllProjects();
    return successResponse({ scanned: cards.length, projects: cards });
  } catch (err) {
    return errorResponse(
      `Scan failed: ${err instanceof Error ? err.message : String(err)}`,
      500
    );
  }
});
