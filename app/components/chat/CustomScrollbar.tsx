/**
 * CustomScrollbar — Sprint 10.6
 *
 * Renders colored tick marks overlaid on the scrollbar track to show
 * conversation landmarks: code blocks, user messages, interruptions.
 */

'use client';

import { useMemo } from 'react';
import type { MessageProps } from './Message';

interface Landmark {
  position: number;
  color: string;
  height: number;
  opacity: number;
  tooltip: string;
}

interface CustomScrollbarProps {
  messages: MessageProps[];
  containerHeight: number;
}

function hasCodeBlock(content: string): boolean {
  return /```[\s\S]*?```/.test(content);
}

export function CustomScrollbar({ messages, containerHeight }: CustomScrollbarProps) {
  const landmarks = useMemo(() => {
    if (messages.length === 0) return [];

    const result: Landmark[] = [];
    const total = messages.length;

    for (let i = 0; i < total; i++) {
      const msg = messages[i]!;
      const position = total === 1 ? 0.5 : i / (total - 1);

      if (msg.role === 'user') {
        result.push({ position, color: 'var(--frost)', height: 1, opacity: 0.15, tooltip: 'User message' });
      }

      if (msg.role === 'assistant' && hasCodeBlock(msg.content)) {
        result.push({ position, color: 'var(--teal-400, #2dd4bf)', height: 2, opacity: 0.5, tooltip: 'Code block' });
      }

      if (msg.role === 'assistant' && msg.content.startsWith('Error:')) {
        result.push({ position, color: 'var(--red-400, #f87171)', height: 3, opacity: 0.7, tooltip: 'Error or interruption' });
      }

      if (msg.role === 'assistant' && msg.content.length > 2000) {
        result.push({ position, color: 'var(--cyan)', height: 2, opacity: 0.3, tooltip: 'Detailed response' });
      }
    }

    return result;
  }, [messages]);

  if (landmarks.length === 0 || containerHeight <= 0) return null;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-2 pointer-events-none z-10" aria-hidden>
      {landmarks.map((lm, i) => (
        <div
          key={i}
          className="absolute right-0"
          style={{
            top: `${lm.position * 100}%`,
            width: '100%',
            height: `${lm.height}px`,
            backgroundColor: lm.color,
            opacity: lm.opacity,
            borderRadius: '1px',
          }}
          title={lm.tooltip}
        />
      ))}
    </div>
  );
}