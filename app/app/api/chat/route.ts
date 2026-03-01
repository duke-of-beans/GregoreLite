/**
 * Chat API Route
 *
 * POST /api/chat - Send message and get AI response
 *
 * Uses OrchestrationExecutor for intelligent routing
 * and multi-model orchestration.
 *
 * @module api/chat
 */

import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { OrchestrationExecutor } from '@/lib/orchestration/executor';
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

  // Validate message length
  if (body.message.length > 10000) {
    return validationError('Message too long (max 10,000 characters)');
  }

  // Initialize orchestrator
  const executor = new OrchestrationExecutor();

  try {
    // Execute orchestrated query
    const orchestrationRequest: {
      query: string;
      systemPrompt?: string;
      temperature?: number;
      userPreferences?: {
        maxCost?: number;
        maxLatency?: number;
        preferredProvider?: string;
      };
    } = {
      query: body.message,
    };

    if (body.systemPrompt) {
      orchestrationRequest.systemPrompt = body.systemPrompt;
    }
    if (body.temperature !== undefined) {
      orchestrationRequest.temperature = body.temperature;
    }
    if (body.preferences) {
      orchestrationRequest.userPreferences = body.preferences;
    }

    const result = await executor.execute(orchestrationRequest);

    if (!result.ok) {
      return errorResponse(result.error.message, 500);
    }

    const orchestrationResult = result.value;

    // Generate IDs
    const conversationId = body.conversationId || `conv_${nanoid()}`;
    const messageId = `msg_${nanoid()}`;

    // Build response
    const chatResponse: ChatResponse = {
      content: orchestrationResult.response.content,
      conversationId,
      messageId,
      strategy: orchestrationResult.strategy,
      modelsUsed: orchestrationResult.modelsUsed,
      totalCost: orchestrationResult.totalCost,
      totalLatencyMs: orchestrationResult.totalLatencyMs,
      ghostApproved: orchestrationResult.ghostApproved,
      ghostMetrics: {
        preApproval: orchestrationResult.ghostMetrics.preApproval,
        postApproval: orchestrationResult.ghostMetrics.postApproval,
        sacredLawsViolated: orchestrationResult.ghostMetrics.violationsDetected,
        rMetric: orchestrationResult.ghostMetrics.rMetric,
      },
      metabolismMetrics: orchestrationResult.metabolismMetrics,
      usage: {
        inputTokens: orchestrationResult.response.usage.inputTokens,
        outputTokens: orchestrationResult.response.usage.outputTokens,
        totalTokens: orchestrationResult.response.usage.totalTokens,
      },
    };

    return successResponse(chatResponse, 200);
  } catch (error) {
    console.error('Chat API error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to process message',
      500
    );
  }
});
