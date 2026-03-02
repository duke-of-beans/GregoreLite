/**
 * Chat API Route
 *
 * POST /api/chat - Send message and get AI response
 *
 * Direct Anthropic SDK call with KERNL persistence.
 * Maintains full conversation history per thread.
 * Checkpoints after every assistant response for crash recovery.
 * Phase 1 foundation — context injection added in Sprint 1D.
 *
 * @module api/chat
 */

import { NextResponse } from 'next/server';
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
import {
  createThread,
  getThread,
  getThreadMessages,
  addMessage,
} from '@/lib/kernl';
import { checkpoint } from '@/lib/continuity';
import { getBootstrapSystemPrompt } from '@/lib/bootstrap';
import { embed, persistEmbeddingsFull } from '@/lib/embeddings';
import { recordUserActivity } from '@/lib/indexer';
import { checkOnInput } from '@/lib/cross-context/proactive';
import { useSuggestionStore } from '@/lib/stores/suggestion-store';
import { analyze } from '@/lib/decision-gate';
import type { GateMessage } from '@/lib/decision-gate';
import { useDecisionGateStore } from '@/lib/stores/decision-gate-store';

const client = new Anthropic();

/**
 * POST /api/chat
 *
 * Send message and receive AI response.
 * Persists to KERNL SQLite and checkpoints after each response.
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

  if (!body.message || body.message.trim() === '') {
    return validationError('Missing required field: message');
  }

  if (body.message.length > 10000) {
    return validationError('Message too long (max 10,000 characters)');
  }

  // ─── Thread resolution ───────────────────────────────────────────────────
  let threadId = body.conversationId ?? null;

  if (threadId) {
    // Validate thread exists; if not, create a new one
    const existing = getThread(threadId);
    if (!existing) {
      const thread = createThread({ title: body.message.slice(0, 60) });
      threadId = thread.id;
    }
  } else {
    const thread = createThread({ title: body.message.slice(0, 60) });
    threadId = thread.id;
  }

  // Persist user message to KERNL
  addMessage({
    thread_id: threadId,
    role: 'user',
    content: body.message,
  });

  // Signal user activity to background indexer (resets idle timer)
  recordUserActivity();

  // Fire-and-forget proactive surfacing — does NOT delay chat response (§5.7 blueprint)
  // Runs the full ranking pipeline; if suggestions found, pushes to Zustand store.
  // Phase 4: resolve activeProjectId from thread metadata
  checkOnInput(body.message)
    .then((suggestions) => {
      if (suggestions.length > 0) {
        useSuggestionStore.getState().setSuggestions(suggestions);
      }
    })
    .catch((err: unknown) =>
      console.warn('[proactive] check failed', { err })
    );

  // Build Anthropic messages array from thread history
  const history = getThreadMessages(threadId);
  const anthropicMessages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  const start = Date.now();

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8096,
      system: body.systemPrompt ?? getBootstrapSystemPrompt(),
      messages: anthropicMessages,
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const content = textBlock?.type === 'text' ? textBlock.text : '';
    const latencyMs = Date.now() - start;

    // Persist assistant response to KERNL
    const assistantMsg = addMessage({
      thread_id: threadId,
      role: 'assistant',
      content,
      model: response.model,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      latency_ms: latencyMs,
    });

    // Continuity checkpoint after every assistant response (crash recovery)
    checkpoint(threadId, assistantMsg.id);

    // Fire-and-forget decision gate analysis — does NOT delay chat response (§8 blueprint)
    // Builds full conversation in GateMessage shape; analyze() runs 5 live triggers +
    // 3 stubs. If triggered, result is pushed to Zustand for Sprint 4B UI panel.
    const fullConversation: GateMessage[] = history
      .map((m) => ({
        role: m.role as GateMessage['role'],
        content: m.content,
      }))
      .concat([{ role: 'assistant', content }]);

    analyze(fullConversation)
      .then((result) => {
        if (result.triggered) {
          useDecisionGateStore.getState().setTrigger(result);
        }
      })
      .catch((err: unknown) =>
        console.warn('[decision-gate] analyze failed', { err })
      );

    // Fire-and-forget embedding — does NOT delay chat response (§5.1 blueprint)
    // Sprint 3B: persistEmbeddingsFull writes to content_chunks AND vec_index.
    embed(content, 'conversation', threadId)
      .then((records) => persistEmbeddingsFull(records))
      .catch((err: unknown) =>
        console.warn('[embeddings] persist failed', { err })
      );

    const chatResponse: ChatResponse = {
      content,
      conversationId: threadId,
      messageId: assistantMsg.id,
      model: response.model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
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
