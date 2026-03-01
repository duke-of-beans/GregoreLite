# SPRINT 1A — Foundation Cleanup + Working Chat
## GregLite Phase 1 | Session 1 of 5 (Sequential)
**Status:** READY TO EXECUTE  
**Depends on:** Phase 0 complete (scaffold committed) ✅  
**Blocks:** All Phase 2 sprints

---

## OBJECTIVE

Replace Gregore's orchestration-coupled chat route with a clean, direct Anthropic API call. Make the UI actually work end to end. Phase 0 left two broken Gregore dependencies in the API layer. This sprint kills them and delivers a genuinely working strategic thread.

**Success criteria:**
- Type a message in the UI → get a real Claude response
- No references to OrchestrationExecutor anywhere in GregLite
- No references to ghostApproved, ghostMetrics, metabolismMetrics in active code
- ChatResponse type simplified to GregLite reality
- pnpm type-check passes clean
- pnpm test:run passes (or broken Gregore tests deleted)

---

## FILES TO MODIFY

| File | Action | Reason |
|------|--------|--------|
| `app/app/api/chat/route.ts` | Rewrite | Uses OrchestrationExecutor (deleted) |
| `app/lib/api/types.ts` | Simplify ChatResponse | ghostApproved, ghostMetrics, metabolismMetrics are Gregore-only |
| `app/lib/__tests__/integration/*.test.ts` | Delete all 5 files | Reference deleted orchestration/aot/substrate modules |
| `app/components/chat/ReceiptFooter.tsx` | Delete or stub | References ChatResponse.ghostMetrics |
| `app/components/chat/OrchestrationDetail.tsx` | Delete | References orchestration types |
| `app/components/chat/index.ts` | Update exports | Remove deleted components |

---

## IMPLEMENTATION

### Step 1 — Simplify ChatResponse type

In `app/lib/api/types.ts`, replace ChatResponse with:

```typescript
export interface ChatResponse {
  content: string;
  conversationId: string;
  messageId: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  costUsd: number;
  latencyMs: number;
}
```

### Step 2 — Rewrite chat route

`app/app/api/chat/route.ts` — full replacement:

```typescript
import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import Anthropic from '@anthropic-ai/sdk';
import type { ChatRequest, ChatResponse } from '@/lib/api/types';
import { successResponse, errorResponse, validationError, parseRequestBody, safeHandler } from '@/lib/api/utils';
import { rateLimiter, getRateLimitIdentifier } from '@/lib/api/rate-limiter';

const client = new Anthropic();

export const POST = safeHandler(async (request: Request) => {
  const identifier = getRateLimitIdentifier(request);
  const rateLimit = rateLimiter.check(identifier);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
      { status: 429 }
    );
  }

  const bodyResult = await parseRequestBody<ChatRequest>(request);
  if (!bodyResult.ok) return validationError(bodyResult.error);

  const body = bodyResult.data;
  if (!body.message?.trim()) return validationError('Missing required field: message');
  if (body.message.length > 10000) return validationError('Message too long (max 10,000 characters)');

  const start = Date.now();

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8096,
      system: body.systemPrompt ?? 'You are GregLite, a premier AI development environment. You are Claude, acting as COO to the user\'s CEO role. Be direct, intelligent, and execution-focused.',
      messages: [{ role: 'user', content: body.message }],
    });

    const content = message.content[0].type === 'text' ? message.content[0].text : '';
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
      costUsd: 0, // Phase 2D will wire pricing.ts
      latencyMs,
    };

    return successResponse(chatResponse, 200);
  } catch (error) {
    console.error('[chat/route] Error:', error);
    return errorResponse(error instanceof Error ? error.message : 'Failed to process message', 500);
  }
});
```

### Step 3 — Delete broken files

```
app/lib/__tests__/integration/cognitive-plane-integration.test.ts  → DELETE
app/lib/__tests__/integration/engine-coordination.test.ts          → DELETE
app/lib/__tests__/integration/performance-optimization.test.ts     → DELETE
app/lib/__tests__/integration/repository-integration.test.ts       → DELETE
app/lib/__tests__/integration/substrate-integration.test.ts        → DELETE
app/components/chat/ReceiptFooter.tsx                              → DELETE
app/components/chat/ReceiptPreferencePrompt.tsx                    → DELETE
app/components/chat/OrchestrationDetail.tsx                        → DELETE
app/components/chat/BudgetDisplay.tsx                              → DELETE
app/components/chat/BudgetPreferencePrompt.tsx                     → DELETE
app/components/chat/MemoryIndicator.tsx                            → DELETE
app/components/chat/MemoryModal.tsx                                → DELETE
app/components/chat/MemoryShimmer.tsx                              → DELETE
app/components/chat/OverrideModal.tsx                              → DELETE
```

### Step 4 — Update index.ts exports

`app/components/chat/index.ts` — keep only:
```typescript
export { ChatInterface } from './ChatInterface';
export { MessageList } from './MessageList';
export { Message } from './Message';
export { InputField } from './InputField';
export { SendButton } from './SendButton';
```

### Step 5 — Verify SendButton state types still work

SendButton uses `SendButtonState` — confirm 'checking' | 'approved' | 'warning' | 'veto' | 'normal' still makes sense without Ghost. Simplify to: `'normal' | 'checking' | 'approved' | 'error'` if 'warning'/'veto' are Ghost-only.

### Step 6 — Verify

```bash
pnpm type-check   # must pass clean
pnpm test:run     # must pass or zero failures
pnpm dev          # send a message, get a real Claude response
```

---

## GATES

- [ ] type-check clean
- [ ] Real Claude response in UI
- [ ] No OrchestrationExecutor references anywhere
- [ ] No ghostApproved/ghostMetrics in active code
- [ ] Commit: `sprint-1a: clean chat route, working strategic thread`
