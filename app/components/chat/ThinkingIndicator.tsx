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