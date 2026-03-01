/**
 * Chat API Route
 *
 * POST /api/chat - Send message and get AI response
 *
 * Direct Anthropic SDK call. No orchestration layer.
 * Phase 1 foundation — context injection added in Sprint 1D.
 *
 * @module api/chat
 */

import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import Anthropic from '@anthropic-ai/sdk';
import type { ChatRequest, ChatResponse } from '@/lib/api/types';
import {
  successResponse,
  errorResponse,
  validationError,
  parseRequestBody,
  safeHandler,
} from '@/lib/api/utils';
import {
  rateLimiter,
  getRateLimitIdentifier,
} from '@/lib/api/rate-limiter';

const client = new Anthropic();

/**
 * POST /api/chat
 *
 * Send message and receive AI response
 */
export const POST = safeHandler(async (request: Request) => {
  // Rate limiting
  const identifier = getRateLimitIdentifier(request);
  const rateLimit = rateLimiter.check(identifier);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: rateLimit.retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': rateLimit.retryAfter?.toString() || '60',
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
        },
      }
    );
  }

  // Parse request body
  const bodyResult = await parseRequestBody<ChatRequest>(request);
  if (!bodyResult.ok) {
    return validationError(bodyResult.error);
  }

  const body = bodyResult.data;

  // Validate required fields
  if (!body.message || body.message.trim() === '') {
    return validationError('Missing required field: message');
  }

  if (body.message.length > 10000) {
    return validationError('Message too long (max 10,000 characters)');
  }

  const start = Date.now();

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8096,
      system:
        body.systemPrompt ??
        "You are GregLite, a premier AI development environment. You are Claude, acting as COO to the user's CEO role. Be direct, intelligent, and execution-focused.",
      messages: [{ role: 'user', content: body.message }],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    const content = textBlock?.type === 'text' ? textBlock.text : '';
    const latencyMs = Date.now() - start;

    const chatResponse: ChatResponse = {
      content,
      conversationId: body.conversationId ?? `conv_${nanoid()}`,
      messageId: `msg_${nanoid()}`,
      model: message.model,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        totalTokens: message.usage.input_tokens + message.usage.output_tokens,
      },
      costUsd: 0, // Phase 2D: wire pricing.ts
      latencyMs,
    };

    return successResponse(chatResponse, 200);
  } catch (error) {
    console.error('[chat/route] Error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to process message',
      500
    );
  }
});
