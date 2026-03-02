/**
 * JobStatusBadge — Sprint 7F
 *
 * Maps a session status string to a colored label with optional pulse dot.
 * Colors per BLUEPRINT §4.3 spec:
 *   spawning:    grey   #94a3b8
 *   running:     blue   #3b82f6
 *   working:     blue   #3b82f6 + pulse
 *   validating:  amber  #f59e0b
 *   completed:   green  #22c55e
 *   failed:      red    #ef4444
 *   blocked:     amber  #f59e0b
 *   interrupted: orange #f97316
 *   pending:     grey   #94a3b8
 */

interface StatusConfig {
  label: string;
  color: string;
  pulse: boolean;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  spawning:    { label: 'spawning',    color: '#94a3b8', pulse: true  },
  running:     { label: 'running',     color: '#3b82f6', pulse: true  },
  working:     { label: 'working',     color: '#3b82f6', pulse: true  },
  validating:  { label: 'validating',  color: '#f59e0b', pulse: true  },
  completed:   { label: 'completed',   color: '#22c55e', pulse: false },
  failed:      { label: 'failed',      color: '#ef4444', pulse: false },
  blocked:     { label: 'blocked',     color: '#f59e0b', pulse: true  },
  interrupted: { label: 'interrupted', color: '#f97316', pulse: false },
  pending:     { label: 'pending',     color: '#94a3b8', pulse: false },
};

const FALLBACK: StatusConfig = { label: 'unknown', color: '#94a3b8', pulse: false };

interface JobStatusBadgeProps {
  status: string;
  queuePosition?: number;
  compact?: boolean;
}

export function JobStatusBadge({ status, queuePosition, compact = false }: JobStatusBadgeProps) {
  const cfg = STATUS_MAP[status] ?? FALLBACK;
  const label = status === 'pending' && queuePosition != null
    ? `pending #${queuePosition}`
    : cfg.label;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: compact ? '9px' : '10px',
        color: cfg.color,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: compact ? '5px' : '6px',
          height: compact ? '5px' : '6px',
          borderRadius: '50%',
          background: cfg.color,
          display: 'inline-block',
          animation: cfg.pulse ? 'pulse 1.5s ease-in-out infinite' : 'none',
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}
