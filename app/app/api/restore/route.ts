/**
 * Restore API Route
 *
 * GET /api/restore - Returns last active thread and its messages for boot restore.
 * Called once on app mount to restore conversation after crash/restart.
 *
 * @module api/restore
 */

import { successResponse, errorResponse } from '@/lib/api/utils';
import { safeHandler } from '@/lib/api/utils';
import { getLastActiveThread, restore } from '@/lib/continuity';

export const GET = safeHandler(async () => {
  try {
    const threadId = getLastActiveThread();

    if (!threadId) {
      return successResponse({ restored: false, threadId: null, messages: [] }, 200);
    }

    const conversation = restore(threadId);

    if (!conversation) {
      return successResponse({ restored: false, threadId, messages: [] }, 200);
    }

    return successResponse(
      {
        restored: true,
        threadId: conversation.threadId,
        messages: conversation.messages,
        lastActive: conversation.lastActive,
      },
      200
    );
  } catch (error) {
    console.error('[restore/route] Error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to restore session',
      500
    );
  }
});
