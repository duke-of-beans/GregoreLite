/**
 * Cross-Context Feedback API Route
 *
 * POST /api/cross-context/feedback — Record user feedback on a suggestion.
 *
 * @module api/cross-context/feedback
 */

import { recordFeedback } from '@/lib/cross-context/feedback';
import {
  successResponse,
  errorResponse,
  validationError,
  parseRequestBody,
  safeHandler,
} from '@/lib/api/utils';

interface FeedbackRequest {
  suggestionId: string;
  action: 'accepted' | 'dismissed' | 'ignored';
}

export const POST = safeHandler(async (request: Request) => {
  const bodyResult = await parseRequestBody<FeedbackRequest>(request);
  if (!bodyResult.ok) {
    return validationError(bodyResult.error);
  }

  const { suggestionId, action } = bodyResult.data;

  if (!suggestionId || typeof suggestionId !== 'string') {
    return validationError('suggestionId is required');
  }

  if (!['accepted', 'dismissed', 'ignored'].includes(action)) {
    return validationError('action must be accepted, dismissed, or ignored');
  }

  try {
    recordFeedback(suggestionId, action);
    return successResponse({ recorded: true }, 200);
  } catch (error) {
    console.error('Feedback recording error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to record feedback',
      500
    );
  }
});
