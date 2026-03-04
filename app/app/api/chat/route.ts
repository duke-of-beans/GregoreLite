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
import type { ChatRequest } from '@/lib/api/types';
import {
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
import { getBootstrapSystemPromptBlocks } from '@/lib/bootstrap';
import { embed, persistEmbeddingsFull } from '@/lib/embeddings';
import { recordUserActivity } from '@/lib/indexer';
import { checkOnInput } from '@/lib/cross-context/proactive';
import { useSuggestionStore } from '@/lib/stores/suggestion-store';
import { analyze, getDecisionLock } from '@/lib/decision-gate';
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
  // ── Decision Gate lock enforcement (§8 blueprint) ───────────────────────
  // If a trigger fired from the previous response, the lock is active and
  // all API calls must be blocked until David approves or overrides.
  const lock = getDecisionLock();
  if (lock.locked) {
    return NextResponse.json(
      { error: 'decision_locked', reason: lock.reason, trigger: lock.trigger },
      { status: 423 },
    );
  }

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

  // Transit Map: capture user message event (lib/transit §4.4)
  try {
    const { captureEvent } = await import('@/lib/transit/capture');
    captureEvent({
      conversation_id: threadId,
      event_type: 'flow.message',
      category: 'flow',
      payload: { role: 'user', content_length: body.message.length },
    });
  } catch { /* non-blocking */ }

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

  // Transit Map: topic shift detection — fire-and-forget, never blocks stream
  // history includes the user message just added, so prev user = second-to-last user msg
  try {
    const userMsgs = history.filter((m) => m.role === 'user');
    if (userMsgs.length >= 2) {
      const prev = userMsgs[userMsgs.length - 2]!;
      const { detectTopicShift } = await import('@/lib/transit/topic-detector');
      const { captureEvent: captureShift } = await import('@/lib/transit/capture');
      const shiftResult = detectTopicShift(prev.content, body.message);
      if (shiftResult.isShift) {
        captureShift({
          conversation_id: threadId,
          event_type: 'flow.topic_shift',
          category: 'flow',
          payload: {
            similarity_score: shiftResult.similarity,
            inferred_topic_label: shiftResult.inferredTopic,
          },
        });
      }
    }
  } catch { /* non-blocking — telemetry loss acceptable */ }

  const anthropicMessages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  const start = Date.now();

  try {
    // Sprint 12.0: use content blocks for prompt caching when no override is present.
    // body.systemPrompt (string) takes precedence for custom overrides; otherwise use
    // cached blocks so stable context (dev protocols, identity) hits Anthropic's cache.
    // Cast through unknown to satisfy exactOptionalPropertyTypes: the blocks array
    // is structurally compatible with TextBlockParam[] but our local type has
    // cache_control?: {type:'ephemeral'} vs SDK's CacheControlEphemeralParam | null.
    const systemBlocks = getBootstrapSystemPromptBlocks() as unknown as Anthropic.Messages.TextBlockParam[];
    const systemParam: string | Anthropic.Messages.TextBlockParam[] = body.systemPrompt
      ? body.systemPrompt
      : systemBlocks;

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-5',
      max_tokens: 8096,
      system: systemParam,
      messages: anthropicMessages,
    });

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        // Send conversation ID immediately
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'meta', conversationId: threadId })}\n\n`
        ));

        // Stream text deltas
        stream.on('text', (text) => {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'text_delta', text })}\n\n`
          ));
        });

        // Stream content blocks (thinking, tool_use)
        stream.on('contentBlock', (block) => {
          if (block.type === 'thinking') {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'thinking', thinking: block.thinking })}\n\n`
            ));
          }
          if (block.type === 'tool_use') {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'tool_use', id: block.id, name: block.name, input: block.input })}\n\n`
            ));
          }
        });

        // Wait for stream completion
        try {
          const finalMessage = await stream.finalMessage();
          const textBlock = finalMessage.content.find((b) => b.type === 'text');
          const content = textBlock?.type === 'text' ? textBlock.text : '';
          const latencyMs = Date.now() - start;

          // Sprint 12.0: capture cache token counts (SDK types may lag behind API)
          // Double cast (through unknown) required because Usage lacks index signature.
          const usageExt = finalMessage.usage as unknown as Record<string, unknown>;
          const cacheCreationTokens = (usageExt.cache_creation_input_tokens as number | undefined) ?? 0;
          const cacheReadTokens = (usageExt.cache_read_input_tokens as number | undefined) ?? 0;

          // Persist assistant response to KERNL
          const assistantMsg = addMessage({
            thread_id: threadId,
            role: 'assistant',
            content,
            model: finalMessage.model,
            input_tokens: finalMessage.usage.input_tokens,
            output_tokens: finalMessage.usage.output_tokens,
            latency_ms: latencyMs,
          });

          // Continuity checkpoint
          checkpoint(threadId, assistantMsg.id);

          // Event capture (Transit Map) — lib/transit §4.4
          try {
            const { captureEvent } = await import('@/lib/transit/capture');
            captureEvent({
              conversation_id: threadId,
              message_id: assistantMsg.id,
              event_type: 'flow.message',
              category: 'flow',
              payload: {
                role: 'assistant',
                content_length: content.length,
                model: finalMessage.model,
                input_tokens: finalMessage.usage.input_tokens,
                output_tokens: finalMessage.usage.output_tokens,
                latency_ms: latencyMs,
              },
            });
          } catch { /* non-blocking */ }

          // Fire-and-forget: decision gate, embeddings
          const fullConversation: GateMessage[] = history
            .map((m) => ({
              role: m.role as GateMessage['role'],
              content: m.content,
            }))
            .concat([{ role: 'assistant', content }]);

          analyze(fullConversation)
            .then((result) => {
              if (result.triggered) {
                const { dismissCount } = getDecisionLock();
                useDecisionGateStore.getState().setTrigger(result, dismissCount);

                // Transit Map: system.gate_trigger — fire-and-forget
                void (async () => {
                  try {
                    const { captureEvent: captureGate } = await import('@/lib/transit/capture');
                    captureGate({
                      conversation_id: threadId,
                      message_id: assistantMsg.id,
                      event_type: 'system.gate_trigger',
                      category: 'system',
                      payload: {
                        gate_type: result.trigger,
                        trigger_reason: result.reason,
                        severity: 'high',
                      },
                    });
                  } catch { /* non-blocking */ }
                })();
              }
            })
            .catch((err: unknown) =>
              console.warn('[decision-gate] analyze failed', { err })
            );

          embed(content, 'conversation', threadId)
            .then((records) => persistEmbeddingsFull(records))
            .catch((err: unknown) =>
              console.warn('[embeddings] persist failed', { err })
            );

          // Send completion event
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({
              type: 'done',
              messageId: assistantMsg.id,
              model: finalMessage.model,
              usage: {
                inputTokens: finalMessage.usage.input_tokens,
                outputTokens: finalMessage.usage.output_tokens,
                totalTokens: finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
                cacheCreationTokens,
                cacheReadTokens,
              },
              costUsd: 0,
              latencyMs,
            })}\n\n`
          ));
        } catch (streamErr) {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({
              type: 'error',
              error: streamErr instanceof Error ? streamErr.message : 'Stream failed',
            })}\n\n`
          ));
        }

        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[chat/route] Error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to process message',
      500
    );
  }
});
