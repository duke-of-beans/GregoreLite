/**
 * POST /api/ghost/inject
 *
 * Injects Ghost chunk content as a system message into the active KERNL thread.
 * Called fire-and-forget from GhostCard "Tell me more".
 *
 * The injected message is wrapped in [GHOST CONTEXT - UNTRUSTED CONTENT] markers
 * so Claude treats it as external, untrusted material (Blueprint §6.6).
 * David never sees this injected text in the UI thread.
 *
 * Body: { chunkId: string; source: string; threadId?: string }
 */

import { successResponse, validationError, parseRequestBody, safeHandler } from '@/lib/api/utils';
import { getDatabase } from '@/lib/kernl/database';
import { getThread, addMessage } from '@/lib/kernl';

interface InjectRequest {
  chunkId: string;
  source: string;
  threadId?: string;
}

export const POST = safeHandler(async (request: Request) => {
  const bodyResult = await parseRequestBody<InjectRequest>(request);
  if (!bodyResult.ok) return validationError(bodyResult.error);

  const { chunkId, source, threadId } = bodyResult.data;

  if (!chunkId) return validationError('Missing required field: chunkId');
  if (!source) return validationError('Missing required field: source');

  // No active thread — no-op (David hasn't started a conversation yet)
  if (!threadId) {
    return successResponse({ injected: false, reason: 'no_thread' }, 200);
  }

  const thread = getThread(threadId);
  if (!thread) {
    return successResponse({ injected: false, reason: 'thread_not_found' }, 200);
  }

  // Fetch chunk content
  const db = getDatabase();
  const row = db.prepare(
    `SELECT content FROM content_chunks WHERE id = ? LIMIT 1`
  ).get(chunkId) as { content: string } | undefined;

  if (!row) {
    return successResponse({ injected: false, reason: 'chunk_not_found' }, 200);
  }

  // Build injection string — [GHOST CONTEXT - UNTRUSTED CONTENT] per Blueprint §6.6
  const systemContent =
    `[GHOST CONTEXT - UNTRUSTED CONTENT - Source: ${source}]\n\n` +
    `${row.content}\n\n` +
    `[END GHOST CONTEXT]`;

  addMessage({
    thread_id: threadId,
    role: 'system',
    content: systemContent,
  });

  return successResponse({ injected: true, threadId }, 200);
});
