/**
 * Conversation Detail API Route
 *
 * GET /api/conversations/[id] - Get conversation
 * PATCH /api/conversations/[id] - Update conversation
 * DELETE /api/conversations/[id] - Delete conversation
 *
 * @module api/conversations/[id]
 */

import { NextResponse } from 'next/server';
import { ConversationRepository } from '@/lib/repositories/conversation-repository';
import { MessageRepository } from '@/lib/repositories/message-repository';
import type {
  ConversationDetail,
  ConversationMessage,
  UpdateConversationRequest,
} from '@/lib/api/types';
import {
  successResponse,
  errorResponse,
  validationError,
  parseRequestBody,
} from '@/lib/api/utils';

/**
 * GET /api/conversations/[id]
 *
 * Get conversation details with all messages
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { id } = params;
    
    const repo = new ConversationRepository();

    const result = repo.findByIdWithStats(id);
    if (!result.ok) {
      return errorResponse('Conversation not found', 404);
    }

    const conversation = result.value;

    // Get messages for this conversation
    const messageRepo = new MessageRepository();
    const messagesResult = messageRepo.findByConversation(id);

    const messages: ConversationMessage[] = messagesResult.ok
      ? messagesResult.value.map((msg) => {
          const message: ConversationMessage = {
            id: msg.id,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            createdAt: msg.createdAt.toISOString(),
          };
          
          if (msg.model !== null) {
            message.model = msg.model;
          }
          
          if (msg.inputTokens !== null && msg.outputTokens !== null) {
            message.tokens = {
              input: msg.inputTokens,
              output: msg.outputTokens,
              total: msg.inputTokens + msg.outputTokens,
            };
          }
          
          if (msg.cost !== null) {
            message.cost = msg.cost;
          }
          
          return message;
        })
      : [];

    const detail: ConversationDetail = {
      id: conversation.id,
      title: conversation.title,
      lastMessageAt: conversation.lastMessageAt?.toISOString() || new Date(conversation.updatedAt).toISOString(),
      messageCount: conversation.messageCount,
      model: conversation.model,
      preview: conversation.lastMessagePreview || '',
      pinned: conversation.pinned,
      archived: conversation.archived,
      messages,
      totalTokens: conversation.totalTokens,
      totalCost: conversation.totalCost,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    };

    return successResponse(detail, 200);
  } catch (error) {
    console.error('Get conversation error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to get conversation',
      500
    );
  }
}

/**
 * PATCH /api/conversations/[id]
 *
 * Update conversation
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { id } = params;

    const bodyResult = await parseRequestBody<UpdateConversationRequest>(
      request
    );
    if (!bodyResult.ok) {
      return validationError(bodyResult.error);
    }

    const body = bodyResult.data;
    const repo = new ConversationRepository();

    // Check if conversation exists
    const existsResult = repo.findById(id);
    if (!existsResult.ok) {
      return errorResponse('Conversation not found', 404);
    }

    // Build update object
    const updateData: {
      title?: string;
      pinned?: boolean;
      archived?: boolean;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (body.title !== undefined) {
      updateData.title = body.title;
    }
    if (body.pinned !== undefined) {
      updateData.pinned = body.pinned;
    }
    if (body.archived !== undefined) {
      updateData.archived = body.archived;
    }

    // Update conversation
    const result = repo.update(id, updateData);
    if (!result.ok) {
      return errorResponse(result.error.message, 500);
    }

    const updated = result.value;

    return successResponse(
      {
        id: updated.id,
        title: updated.title,
        pinned: updated.pinned,
        archived: updated.archived,
      },
      200
    );
  } catch (error) {
    console.error('Update conversation error:', error);
    return errorResponse(
      error instanceof Error
        ? error.message
        : 'Failed to update conversation',
      500
    );
  }
}

/**
 * DELETE /api/conversations/[id]
 *
 * Delete conversation
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { id} = params;
    
    const repo = new ConversationRepository();

    // Check if conversation exists
    const existsResult = repo.findById(id);
    if (!existsResult.ok) {
      return errorResponse('Conversation not found', 404);
    }

    // Delete conversation
    const result = repo.delete(id);
    if (!result.ok) {
      return errorResponse(result.error.message, 500);
    }

    return successResponse({ id }, 200);
  } catch (error) {
    console.error('Delete conversation error:', error);
    return errorResponse(
      error instanceof Error
        ? error.message
        : 'Failed to delete conversation',
      500
    );
  }
}
