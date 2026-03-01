/**
 * POST /api/cross-context/inject
 *
 * Injects a matched chunk as a system context message into the specified thread.
 * Called fire-and-forget from SuggestionCard "Tell me more" action.
 *
 * Body: { content: string; sourceId: string; sourceType: string; threadId?: string }
 *
 * If threadId is absent or the thread does not exist, returns 200 with a
 * no-op result so the client never sees an error.
 *
 * @module api/cross-context/inject
 */

import {
  successResponse,
  validationError,
  parseRequestBody,
  safeHandler,
} from '@/lib/api/utils';
import { getThread, addMessage } from '@/lib/kernl';

interface InjectRequest {
  content: string;
  sourceId: string;
  sourceType: string;
  threadId?: string;
}

export const POST = safeHandler(async (request: Request) => {
  const bodyResult = await parseRequestBody<InjectRequest>(request);
  if (!bodyResult.ok) {
    return validationError(bodyResult.error);
  }

  const body = bodyResult.data;

  if (!body.content || body.content.trim() === '') {
    return validationError('Missing required field: content');
  }

  // No threadId → no-op (caller didn't have an active conversation)
  if (!body.threadId) {
    return successResponse({ injected: false, reason: 'no_thread' }, 200);
  }

  const thread = getThread(body.threadId);
  if (!thread) {
    return successResponse({ injected: false, reason: 'thread_not_found' }, 200);
  }

  const sourceLabel =
    body.sourceType === 'conversation'
      ? `thread:${body.sourceId.slice(0, 8)}`
      : body.sourceId;

  const systemContent = `Related context from [${sourceLabel}]:\n\n${body.content}`;

  addMessage({
    thread_id: body.threadId,
    role: 'system',
    content: systemContent,
  });

  return successResponse({ injected: true, threadId: body.threadId }, 200);
});
