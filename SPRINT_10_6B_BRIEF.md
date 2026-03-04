# SPRINT 10.6B — EXECUTION BRIEF: SSE Streaming
# Wave 2: Convert /api/chat from blocking JSON to Server-Sent Events
# Prerequisites: Brief A complete (API routes working, schema laid)
# Gate: Send message → see tokens appear progressively. Usage stats on completion.

---

## CONTEXT

You are working on GregLite, a Tauri + Next.js 16 + React 19 + TypeScript desktop app.
Project root: `D:\Projects\GregLite`
App directory: `D:\Projects\GregLite\app`

Read the full sprint blueprint: `D:\Projects\GregLite\SPRINT_10_6_BLUEPRINT.md` (Task 3)

This is the most important task in the sprint. Everything after this depends on it.

---

## WHAT YOU'RE CHANGING

The current `/api/chat` route calls `client.messages.create()` (blocking), waits for the
full response (5-30 seconds of silence), then returns a single JSON blob. You are converting
this to SSE streaming using the Anthropic SDK's `client.messages.stream()`.

Three files change:
1. `app/app/api/chat/route.ts` — SSE response
2. `app/components/chat/ChatInterface.tsx` — stream consumer in handleSubmit
3. `app/lib/stores/thread-tabs-store.ts` — new streaming message actions

One file gets a minor type change:
4. `app/components/chat/Message.tsx` — add `isStreaming` to MessageProps

---

## STEP 1: Understand the current chat route

Read: `D:\Projects\GregLite\app\app\api\chat\route.ts`

The current flow is:
1. Rate limit check
2. Parse request body
3. Decision gate lock check
4. Thread resolution (create or find)
5. Persist user message to KERNL via `addMessage()`
6. Build Anthropic messages array from thread history
7. `client.messages.create()` — **BLOCKING CALL**
8. Extract text content from response
9. Persist assistant message to KERNL
10. Checkpoint for crash recovery
11. Fire-and-forget: decision gate analysis, embeddings, proactive surfacing
12. Return JSON response

You are changing step 7 to streaming and step 12 to SSE.

Steps 1-6 stay the same. Steps 8-11 move into the stream completion handler.

---

## STEP 2: Modify the chat route

Replace the try/catch block that calls `client.messages.create()` with:

```typescript
try {
  const stream = client.messages.stream({
    model: 'claude-sonnet-4-5',
    max_tokens: 8096,
    system: body.systemPrompt ?? getBootstrapSystemPrompt(),
    messages: anthropicMessages,
  });

  const encoder = new TextEncoder();

  const readableStream = new ReadableStream({
    async start(controller) {
      // ── Immediately send conversation ID ────────────────────────
      controller.enqueue(encoder.encode(
        `data: ${JSON.stringify({ type: 'meta', conversationId: threadId })}\n\n`
      ));

      // ── Stream text deltas ──────────────────────────────────────
      stream.on('text', (text) => {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'text_delta', text })}\n\n`
        ));
      });

      // ── Stream content blocks (thinking, tool_use) ──────────────
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

      // ── Wait for stream completion ──────────────────────────────
      try {
        const finalMessage = await stream.finalMessage();
        const textBlock = finalMessage.content.find((b) => b.type === 'text');
        const content = textBlock?.type === 'text' ? textBlock.text : '';
        const latencyMs = Date.now() - start;

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

        // Event capture (Transit Map)
        try {
          const { captureEvent } = await import('@/lib/events/capture');
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

        // Fire-and-forget: decision gate, embeddings, proactive surfacing
        // (copy existing fire-and-forget blocks from the current route here)
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

        // ── Send completion event ───────────────────────────────────
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({
            type: 'done',
            messageId: assistantMsg.id,
            model: finalMessage.model,
            usage: {
              inputTokens: finalMessage.usage.input_tokens,
              outputTokens: finalMessage.usage.output_tokens,
              totalTokens: finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
            },
            costUsd: 0, // Wire pricing.ts later
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
```

IMPORTANT: Keep the user message `addMessage()` and `captureEvent` for user messages
BEFORE the stream — those happen before we start generating. Also keep `recordUserActivity()`
and `checkOnInput()` fire-and-forget before the stream starts.

---

## STEP 3: Modify ChatInterface.tsx handleSubmit

Read the current `handleSubmit` in: `D:\Projects\GregLite\app\components\chat\ChatInterface.tsx`

Replace the fetch + JSON parsing section. The new flow:

```typescript
const handleSubmit = useCallback(async () => {
  if (!input.trim() || !activeTabId) return;

  const messageText = input;
  const tabId = activeTabId;
  const conversationId = activeConversationId;

  setInput('');
  setTabGhostContext(tabId, null);

  const userMessage: MessageProps = {
    role: 'user',
    content: messageText,
    timestamp: new Date(),
  };
  appendMessage(tabId, userMessage);
  setSendButtonState('checking');

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: messageText,
        ...(conversationId && { conversationId }),
      }),
    });

    if (response.status === 423) {
      const data = await response.json() as { error: string; reason?: string };
      const errorMessage: MessageProps = {
        role: 'assistant',
        content: `⚠ Decision Gate active — ${data.reason ?? 'approve or dismiss the gate before continuing'}`,
        timestamp: new Date(),
      };
      appendMessage(tabId, errorMessage);
      setSendButtonState('normal');
      return;
    }

    if (!response.ok || !response.body) {
      throw new Error(`API error: ${response.statusText}`);
    }

    // ── SSE Stream Consumer ───────────────────────────────────────────
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let streamConversationId = conversationId;
    let sseBuffer = '';

    // Add empty streaming message placeholder
    const streamingMsg: MessageProps = {
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };
    appendMessage(tabId, streamingMsg);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      sseBuffer += decoder.decode(value, { stream: true });

      // Parse complete SSE lines from buffer
      const lines = sseBuffer.split('\n');
      sseBuffer = lines.pop() ?? ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));

          if (event.type === 'meta' && event.conversationId) {
            streamConversationId = event.conversationId;
            if (!conversationId) {
              setTabConversationId(tabId, event.conversationId);
              setActiveThreadId(event.conversationId);

              // Auto-title (fire-and-forget)
              const newConvId = event.conversationId;
              void generateTitle(messageText).then((title) => {
                if (title && title !== 'Untitled') {
                  renameTab(tabId, title);
                  void fetch(`/api/conversations/${newConvId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title }),
                  }).catch(() => null);
                }
              });
            }
          }

          if (event.type === 'text_delta') {
            fullContent += event.text;
            updateStreamingMessage(tabId, fullContent);
          }

          if (event.type === 'done') {
            finalizeStreamingMessage(tabId, fullContent, {
              model: event.model,
              tokens: event.usage?.totalTokens,
              costUsd: event.costUsd,
              latencyMs: event.latencyMs,
            });

            // Artifact detection (same as before)
            const artifact = detectArtifact(fullContent);
            if (artifact) {
              artifact.threadId = streamConversationId ?? '';
              setTabArtifact(tabId, artifact);
              void syncArtifact(artifact, streamConversationId ?? '');
            }
          }

          if (event.type === 'error') {
            updateStreamingMessage(tabId, `Error: ${event.error}`);
            finalizeStreamingMessage(tabId, `Error: ${event.error}`, {});
          }
        } catch {
          // Malformed SSE line — skip
        }
      }
    }

    setSendButtonState('approved');
    setTimeout(() => setSendButtonState('normal'), 1500);
  } catch (error) {
    const errorMessage: MessageProps = {
      role: 'assistant',
      content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date(),
    };
    appendMessage(tabId, errorMessage);
    setSendButtonState('normal');
  }
}, [input, activeTabId, activeConversationId, appendMessage, setTabConversationId,
    setActiveThreadId, setTabGhostContext, setTabArtifact, renameTab,
    updateStreamingMessage, finalizeStreamingMessage]);
```

Add `updateStreamingMessage` and `finalizeStreamingMessage` to the destructured store selectors
at the top of the component (same pattern as the existing ones like `appendMessage`).

---

## STEP 4: Add store actions to thread-tabs-store.ts

Read: `D:\Projects\GregLite\app\lib\stores\thread-tabs-store.ts`

Add two new actions to the store:

```typescript
// Updates the content of the last message in the tab (streaming in progress)
updateStreamingMessage: (tabId: string, content: string) => {
  set((state) => {
    const tab = state.tabs.find((t) => t.id === tabId);
    if (!tab || tab.messages.length === 0) return state;
    const messages = [...tab.messages];
    const lastIdx = messages.length - 1;
    messages[lastIdx] = { ...messages[lastIdx]!, content, isStreaming: true };
    return {
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, messages } : t
      ),
    };
  });
},

// Marks streaming complete, adds metadata to the message
finalizeStreamingMessage: (tabId: string, content: string, meta: {
  model?: string;
  tokens?: number;
  costUsd?: number;
  latencyMs?: number;
}) => {
  set((state) => {
    const tab = state.tabs.find((t) => t.id === tabId);
    if (!tab || tab.messages.length === 0) return state;
    const messages = [...tab.messages];
    const lastIdx = messages.length - 1;
    messages[lastIdx] = {
      ...messages[lastIdx]!,
      content,
      isStreaming: false,
      model: meta.model,
      tokens: meta.tokens,
      costUsd: meta.costUsd,
      latencyMs: meta.latencyMs,
    };
    return {
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, messages } : t
      ),
    };
  });
},
```

Also add these to the store's type interface and ensure they're exported with selectors.

---

## STEP 5: Update MessageProps type

In `D:\Projects\GregLite\app\components\chat\Message.tsx`, update the MessageProps interface:

```typescript
export interface MessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date | undefined;
  highlightQuery?: string | undefined;
  isActiveMatch?: boolean | undefined;
  onEdit?: (() => void) | undefined;
  onRegenerate?: (() => void) | undefined;
  // ── New streaming fields ──────────────────
  isStreaming?: boolean | undefined;
  model?: string | undefined;
  tokens?: number | undefined;
  costUsd?: number | undefined;
  latencyMs?: number | undefined;
}
```

In the Message component render, add a subtle blinking cursor when `isStreaming`:

After the content rendering (both user and assistant paths), add:
```typescript
{isStreaming && (
  <span className="animate-pulse text-[var(--cyan)]">▌</span>
)}
```

Add this CSS animation if not already available (or use Tailwind's `animate-pulse`).

---

## STEP 6: Verify the full flow

1. Start dev server: `cd D:\Projects\GregLite\app && pnpm dev`
2. Open http://localhost:3000
3. Send a message
4. VERIFY: Tokens appear progressively (not all at once after delay)
5. VERIFY: Conversation ID is set on the tab after first meta event
6. VERIFY: Auto-title fires for new conversations
7. VERIFY: Message finalizes with metadata after stream completes
8. VERIFY: Artifact detection still works on completed messages
9. VERIFY: KERNL persistence — message appears in database after completion
10. VERIFY: Crash recovery checkpoint fires after completion

---

## FINAL GATES

1. `npx tsc --noEmit` — zero errors
2. `pnpm test:run` — 890+ tests passing (update/add tests if existing tests break due to API response format change)
3. Tokens stream progressively
4. No regressions on KERNL persistence, checkpointing, artifact detection, auto-title
5. Error handling works (kill dev server mid-stream → graceful error in UI)

## COMMITS

```
feat(chat): SSE streaming for chat responses — progressive token rendering
```
