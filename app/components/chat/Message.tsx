/**
 * Message Component
 * 
 * Individual message display with distinct user/AI styling.
 * Part of Phase 5.0 P0 Foundation.
 * 
 * Spec: docs/UI_UX_FINAL_DIRECTION.md Part 8.1
 * Design: docs/DESIGN_SYSTEM.md Part 3 (Message Rendering)
 */

'use client';

import { ReactNode } from 'react';

export interface MessageProps {
  role: 'user' | 'assistant';
  content: string | ReactNode;
  timestamp?: Date | undefined;
}

export function Message({ role, content, timestamp }: MessageProps) {
  const isUser = role === 'user';

  return (
    <div
      className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
      role="article"
      aria-label={`${isUser ? 'User' : 'AI'} message`}
    >
      <div
        className={`max-w-[80%] rounded-lg p-4 ${
          isUser
            ? 'border-l-[3px] border-[var(--cyan)] bg-[var(--cyan)]/10 text-[var(--ice-white)]'
            : 'bg-[var(--elevated)]/60 text-[var(--ice-white)]'
        }`}
      >
        {/* Message Content */}
        <div className="prose prose-invert prose-sm max-w-none">
          {typeof content === 'string' ? (
            <p className="m-0 whitespace-pre-wrap break-words">{content}</p>
          ) : (
            content
          )}
        </div>

        {/* Timestamp (Optional) */}
        {timestamp !== undefined && (
          <div className="mt-2 text-xs text-[var(--mist)]">
            {timestamp.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        )}
      </div>
    </div>
  );
}
