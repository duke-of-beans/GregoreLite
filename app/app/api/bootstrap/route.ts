/**
 * Bootstrap API Route
 *
 * POST /api/bootstrap - Trigger bootstrap sequence and return context package summary.
 * Called once on app mount (non-blocking — UI renders immediately).
 *
 * @module api/bootstrap
 */

import { safeHandler, successResponse, errorResponse } from '@/lib/api/utils';
import { runBootstrap } from '@/lib/bootstrap';

export const POST = safeHandler(async () => {
  try {
    const result = await runBootstrap();

    return successResponse(
      {
        success: result.success,
        coldStartMs: result.package.coldStartMs,
        hasDevProtocols: {
          technicalStandards: result.package.devProtocols.technicalStandards !== null,
          claudeInstructions: result.package.devProtocols.claudeInstructions !== null,
        },
        kernlContext: {
          activeProjects: result.package.kernlContext.activeProjects.length,
          recentDecisions: result.package.kernlContext.recentDecisions.length,
          lastSessionSummary: result.package.kernlContext.lastSessionSummary,
          activeSession: result.package.kernlContext.activeSession,
        },
        errors: result.errors,
      },
      200
    );
  } catch (error) {
    console.error('[bootstrap/route] Error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Bootstrap failed',
      500
    );
  }
});
