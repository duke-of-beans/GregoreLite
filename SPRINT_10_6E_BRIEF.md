# SPRINT 10.6E — EXECUTION BRIEF: Thinking Indicator + Collapsible Blocks
# Wave 4: Stream-dependent UI — processing states and tool/thinking accordions
# Prerequisites: Brief B complete (SSE streaming working)
# Gate: Thinking dots on send, streaming cursor, collapsible thinking/tool blocks

---

## CONTEXT

Project root: `D:\Projects\GregLite`, App: `D:\Projects\GregLite\app`
Blueprint: `D:\Projects\GregLite\SPRINT_10_6_BLUEPRINT.md` (Tasks 7 and 8)

SSE streaming is now live (Brief B). The chat route sends `text_delta`, `thinking`,
`tool_use`, and `done` events. This brief builds the UI that consumes those events.

---

## TASK 1 — Thinking/Processing Indicator (Blueprint Task 7)

### Create ThinkingIndicator component

Create: `D:\Projects\GregLite\app\components\chat\ThinkingIndicator.tsx`

```typescript
/**
 * ThinkingIndicator — Sprint 10.6
 *
 * Animated three-dot indicator shown after user sends a message,
 * before the first text_delta arrives from the stream.
 */

'use client';

export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-1 py-2" role="status" aria-label="Thinking">
      <span
        className="text-[11px] text-[var(--mist)] mr-1"
        style={{ fontSize: 'var(--msg-role-size, 11px)' }}
      >
        GregLite
      </span>
      <span className="flex items-center gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--cyan)]"
            style={{
              animation: 'thinking-pulse 1.4s infinite ease-in-out',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </span>

      <style>{`
        @keyframes thinking-pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
```

### Create ProcessingStatus component

Create: `D:\Projects\GregLite\app\components\chat\ProcessingStatus.tsx`

```typescript
/**
 * ProcessingStatus — Sprint 10.6
 *
 * Shows tool/thinking status lines during streaming.
 * Appears above the streaming message content.
 */

'use client';

import { useState, useEffect } from 'react';

export interface ProcessingEvent {
  type: 'thinking' | 'tool_use';
  name?: string;       // tool name for tool_use
  startTime: number;   // Date.now() when event started
}

interface ProcessingStatusProps {
  events: ProcessingEvent[];
}

function ElapsedTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return <span>{elapsed}s</span>;
}

export function ProcessingStatus({ events }: ProcessingStatusProps) {
  if (events.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5 mb-1">
      {events.map((event, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5 text-[10px] text-[var(--mist)] animate-pulse"
        >
          {event.type === 'thinking' && (
            <>
              <span>🧠</span>
              <span>Thinking... (<ElapsedTimer startTime={event.startTime} />)</span>
            </>
          )}
          {event.type === 'tool_use' && (
            <>
              <span>🔧</span>
              <span>Using {event.name ?? 'tool'}...</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
```

### Wire into MessageList.tsx

Read: `D:\Projects\GregLite\app\components\chat\MessageList.tsx`

Import `ThinkingIndicator` and render it when the last message is a user message
AND the component is in a "waiting for response" state.

You need a way to know if we're waiting. The simplest approach: check if the last
message has `role === 'user'` and the component's parent has indicated streaming is
pending. OR: add a `isWaitingForResponse` prop to MessageList.

Add after the last message in the message list:

```typescript
{/* Thinking indicator — shown when waiting for stream to start */}
{messages.length > 0 &&
 messages[messages.length - 1]?.role === 'user' &&
 isWaitingForResponse && (
  <ThinkingIndicator />
)}
```

Pass `isWaitingForResponse` from ChatInterface based on `sendButtonState === 'checking'`
AND no streaming message present yet.

### Wire ProcessingStatus into streaming messages

In ChatInterface.tsx's handleSubmit SSE consumer, track processing events:

Add state for processing events:
```typescript
const [processingEvents, setProcessingEvents] = useState<ProcessingEvent[]>([]);
```

In the SSE consumer, when `thinking` or `tool_use` events arrive:
```typescript
if (event.type === 'thinking') {
  setProcessingEvents(prev => [...prev, { type: 'thinking', startTime: Date.now() }]);
}
if (event.type === 'tool_use') {
  setProcessingEvents(prev => [...prev, { type: 'tool_use', name: event.name, startTime: Date.now() }]);
}
if (event.type === 'text_delta') {
  // Clear processing events when text starts flowing
  if (processingEvents.length > 0) setProcessingEvents([]);
  // ... existing text_delta handling
}
if (event.type === 'done') {
  setProcessingEvents([]);
  // ... existing done handling
}
```

Pass `processingEvents` to MessageList or render ProcessingStatus directly in ChatInterface
above the streaming message area.

---

## TASK 2 — Collapsible Tool & Thinking Blocks (Blueprint Task 8)

### Create CollapsibleBlock component

Create: `D:\Projects\GregLite\app\components\chat\CollapsibleBlock.tsx`

```typescript
/**
 * CollapsibleBlock — Sprint 10.6
 *
 * Generic accordion for thinking and tool-use blocks within messages.
 * Collapsed by default. Shows summary header, expands to show content.
 */

'use client';

import { useState } from 'react';

interface CollapsibleBlockProps {
  type: 'thinking' | 'tool_use' | 'tool_result';
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function CollapsibleBlock({ type, summary, children, defaultOpen = false }: CollapsibleBlockProps) {
  const [open, setOpen] = useState(defaultOpen);

  const icon = type === 'thinking' ? '🧠' : type === 'tool_use' ? '🔧' : '📋';
  const bgColor = type === 'thinking'
    ? 'var(--elevated)'
    : 'var(--shadow)';

  return (
    <div
      className="my-2 rounded border border-[var(--shadow)] overflow-hidden"
      style={{ background: bgColor }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--mist)] hover:text-[var(--frost)] transition-colors"
      >
        <span>{icon}</span>
        <span className="flex-1 text-left">{summary}</span>
        <span className="text-[var(--ghost-text)] text-[10px]">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="border-t border-[var(--shadow)] px-3 py-2 text-[12px] text-[var(--frost)]">
          {children}
        </div>
      )}
    </div>
  );
}
```

### Add block-based rendering to Message.tsx

The MessageProps interface should support an optional `blocks` array for structured content:

```typescript
export interface MessageBlock {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result';
  content: string;
  metadata?: Record<string, unknown>;
}

// Add to MessageProps:
blocks?: MessageBlock[] | undefined;
```

In the assistant message rendering path, check if `blocks` exist. If they do, render
block-by-block instead of the single content string:

```typescript
{!isUser && blocks && blocks.length > 0 ? (
  // Block-based rendering (structured content from SSE)
  <div className="prose prose-invert max-w-none" style={{ fontSize: 'inherit', lineHeight: 'inherit' }}>
    {blocks.map((block, i) => {
      if (block.type === 'text') {
        return (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {block.content}
          </ReactMarkdown>
        );
      }
      if (block.type === 'thinking') {
        const duration = block.metadata?.duration_ms
          ? `${Math.round((block.metadata.duration_ms as number) / 1000)}s`
          : '';
        return (
          <CollapsibleBlock key={i} type="thinking" summary={`Thought${duration ? ` for ${duration}` : ''}`}>
            <p className="whitespace-pre-wrap text-[var(--mist)]">{block.content}</p>
          </CollapsibleBlock>
        );
      }
      if (block.type === 'tool_use') {
        const toolName = (block.metadata?.name as string) ?? 'tool';
        return (
          <CollapsibleBlock key={i} type="tool_use" summary={`Used ${toolName}`}>
            <pre className="text-[11px] font-mono whitespace-pre-wrap text-[var(--frost)]">
              {block.content}
            </pre>
          </CollapsibleBlock>
        );
      }
      return null;
    })}
  </div>
) : !isUser ? (
  // Fallback: single content string (backwards compatible)
  <div className="prose prose-invert max-w-none" style={{ fontSize: 'inherit', lineHeight: 'inherit' }}>
    {/* existing markdown rendering */}
  </div>
) : null}
```

### Wire block construction in SSE consumer

In ChatInterface.tsx handleSubmit, build blocks array during streaming:

```typescript
let blocks: MessageBlock[] = [];
let currentTextBlock = '';

// In the SSE consumer:
if (event.type === 'text_delta') {
  currentTextBlock += event.text;
  fullContent += event.text;
  // Rebuild blocks with current text
  const displayBlocks = [...blocks, { type: 'text' as const, content: currentTextBlock }];
  updateStreamingMessageBlocks(tabId, fullContent, displayBlocks);
}

if (event.type === 'thinking') {
  // Flush current text block
  if (currentTextBlock) {
    blocks.push({ type: 'text', content: currentTextBlock });
    currentTextBlock = '';
  }
  blocks.push({ type: 'thinking', content: event.thinking, metadata: {} });
}

if (event.type === 'tool_use') {
  if (currentTextBlock) {
    blocks.push({ type: 'text', content: currentTextBlock });
    currentTextBlock = '';
  }
  blocks.push({
    type: 'tool_use',
    content: JSON.stringify(event.input, null, 2),
    metadata: { name: event.name },
  });
}
```

Add `updateStreamingMessageBlocks` to the thread-tabs-store (similar to updateStreamingMessage
but also updates blocks array).

---

## FINAL GATES

1. `npx tsc --noEmit` — zero errors
2. `pnpm test:run` — 890+ tests passing
3. Sending a message shows thinking dots before first token
4. Streaming text shows blinking cursor
5. Thinking blocks collapse with "Thought for Xs" header
6. Tool use blocks collapse with "Used [tool_name]" header
7. Clicking collapsed blocks expands them
8. All indicators disappear on stream completion

## COMMITS

```
feat(ux): thinking indicator and streaming cursor for processing states
feat(ux): collapsible tool and thinking blocks in messages
```
