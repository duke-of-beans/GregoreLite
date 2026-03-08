'use client';
/**
 * QueuePositionBadge — Sprint 7E
 *
 * Displays the queue position for a PENDING session.
 * Renders nothing when the session is running or has no position.
 *
 * Props:
 *   position     - 1-based queue position (null if running/completed)
 *   sessionType  - used to derive a priority label
 *   throttled    - true when the queue position is due to rate limiting
 */


interface QueuePositionBadgeProps {
  position: number | null;
  sessionType?: string;
  throttled?: boolean;
  className?: string;
}

const PRIORITY_LABEL: Record<string, string> = {
  strategic_thread: 'Strategic',
  self_evolution:   'Evo',
  code:             'Code',
  test:             'Test',
  docs:             'Docs',
  documentation:    'Docs',
  deploy:           'Deploy',
  research:         'Research',
  analysis:         'Analysis',
  ghost:            'Ghost',
};

export function QueuePositionBadge({
  position,
  sessionType,
  throttled = false,
  className = '',
}: QueuePositionBadgeProps) {
  if (position === null || position === undefined) return null;

  const typeLabel = sessionType ? (PRIORITY_LABEL[sessionType] ?? sessionType) : null;
  const reason = throttled ? 'Rate limited' : 'Waiting for slot';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium
        bg-amber-100 text-amber-800 border border-amber-200 ${className}`}
      title={`Queue position ${position} — ${reason}`}
    >
      <span className="font-mono font-bold">#{position}</span>
      {typeLabel && <span className="opacity-70">{typeLabel}</span>}
      {throttled && (
        <span className="ml-0.5 text-amber-600" title="Token rate limit">⏳</span>
      )}
    </span>
  );
}

export default QueuePositionBadge;
