/**
 * Conversations API Route
 *
 * GET /api/conversations - List conversations
 * POST /api/conversations - Create new conversation
 *
 * @module api/conversations
 */

import { ConversationRepository } from '@/lib/repositories/conversation-repository';
import type {
  ConversationListItem,
  CreateConversationRequest,
} from '@/lib/api/types';
import {
  successResponse,
  errorResponse,
  validationError,
  parseRequestBody,
  safeHandler,
  getSearchParams,
  parsePaginationParams,
} from '@/lib/api/utils';

/**
 * GET /api/conversations
 *
 * List all conversations with pagination
 */
export const GET = safeHandler(async (request: Request) => {
  const searchParams = getSearchParams(request);
  const { page, pageSize } = parsePaginationParams(searchParams);

  try {
    const repo = new ConversationRepository();

    // Use repository's list method with pagination
    const result = repo.listConversations({
      page,
      pageSize,
    });

    if (!result.ok) {
      return errorResponse(result.error.message, 500);
    }

    const { items, total, totalPages, hasNext, hasPrev } = result.value;

    // Map to API format
    const conversations: ConversationListItem[] = items.map((conv) => ({
      id: conv.id,
      title: conv.title,
      lastMessageAt: conv.lastMessageAt?.toISOString() || new Date(conv.updatedAt).toISOString(),
      messageCount: conv.messageCount,
      model: conv.model,
      preview: conv.lastMessagePreview || '',
      pinned: conv.pinned,
      archived: conv.archived,
    }));

    return successResponse(
      {
        conversations,
        pagination: {
          page,
          pageSize,
          totalItems: total,
          totalPages,
          hasNext,
          hasPrevious: hasPrev,
        },
      },
      200
    );
  } catch (error) {
    console.error('List conversations error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to list conversations',
      500
    );
  }
});

/**
 * POST /api/conversations
 *
 * Create new conversation
 */
export const POST = safeHandler(async (request: Request) => {
  const bodyResult = await parseRequestBody<CreateConversationRequest>(
    request
  );
  if (!bodyResult.ok) {
    return validationError(bodyResult.error);
  }

  const body = bodyResult.data;

  try {
    const repo = new ConversationRepository();

    // Create conversation
    const result = repo.createConversation({
      title: body.title || 'New Conversation',
      model: 'claude-sonnet-4',
      modelTier: 'sonnet',
    });

    if (!result.ok) {
      return errorResponse(result.error.message, 500);
    }

    const conversation = result.value;

    return successResponse(
      {
        id: conversation.id,
        title: conversation.title,
      },
      201
    );
  } catch (error) {
    console.error('Create conversation error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to create conversation',
      500
    );
  }
});
