'use client';
/**
 * DecisionRow — S9-16
 * Single row in the decision list: impact badge, category, title, date.
 */


const impactColors: Record<string, string> = {
  high: 'var(--error)',
  medium: 'var(--warning)',
  low: 'var(--success)',
};

interface DecisionItem {
  id: string;
  category: string;
  title: string;
  impact: string | null;
  created_at: number;
}

interface Props {
  decision: DecisionItem;
  selected: boolean;
  onClick: () => void;
}

export function DecisionRow({ decision, selected, onClick }: Props) {
  const date = new Date(decision.created_at);
  const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 6,
        border: 'none',
        background: selected ? 'var(--elevated)' : 'transparent',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
      }}
    >
      {/* Impact badge */}
      <span style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: impactColors[decision.impact ?? ''] ?? 'var(--shadow)',
        flexShrink: 0,
      }} />

      {/* Category */}
      <span style={{ fontSize: 10, color: 'var(--frost)', minWidth: 60, flexShrink: 0 }}>
        {decision.category}
      </span>

      {/* Title */}
      <span style={{
        fontSize: 12,
        color: selected ? 'var(--ice-white)' : 'var(--frost)',
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {decision.title}
      </span>

      {/* Date */}
      <span style={{ fontSize: 10, color: 'var(--shadow)', flexShrink: 0 }}>
        {dateStr}
      </span>
    </button>
  );
}
