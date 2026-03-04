/**
 * ProcessingStatus — Sprint 10.6
 *
 * Shows tool/thinking status lines during streaming.
 */

'use client';

import { useState, useEffect } from 'react';

export interface ProcessingEvent {
  type: 'thinking' | 'tool_use';
  name?: string;
  startTime: number;
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
        <div key={i} className="flex items-center gap-1.5 text-[10px] text-[var(--mist)] animate-pulse">
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