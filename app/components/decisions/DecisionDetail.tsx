/**
 * DecisionDetail — S9-16
 * Right panel: full rationale, alternatives, thread link.
 */

'use client';

interface DecisionFull {
  id: string;
  thread_id: string | null;
  category: string;
  title: string;
  rationale: string;
  alternatives: string[];
  impact: string | null;
  created_at: number;
  project_name: string | null;
}

interface Props {
  decision: DecisionFull | null;
  onOpenThread: (threadId: string) => void;
}

export function DecisionDetail({ decision, onOpenThread }: Props) {
  if (!decision) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--frost)', fontSize: 12 }}>
        Select a decision to view details
      </div>
    );
  }

  const date = new Date(decision.created_at).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
      {/* Header */}
      <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ice-white)', margin: 0 }}>
        {decision.title}
      </h3>

      {/* Meta */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 10,
          padding: '2px 8px',
          borderRadius: 4,
          background: decision.impact === 'high' ? 'var(--error)' : decision.impact === 'medium' ? 'var(--warning)' : 'var(--success)',
          color: 'var(--deep-space)',
          fontWeight: 600,
          textTransform: 'uppercase',
        }}>
          {decision.impact ?? 'unset'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--frost)' }}>{decision.category}</span>
        <span style={{ fontSize: 11, color: 'var(--shadow)' }}>{date}</span>
        {decision.project_name && (
          <span style={{ fontSize: 11, color: 'var(--cyan)' }}>{decision.project_name}</span>
        )}
      </div>

      {/* Rationale */}
      <div>
        <h4 style={{ fontSize: 11, fontWeight: 600, color: 'var(--cyan)', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Rationale
        </h4>
        <p style={{ fontSize: 13, color: 'var(--ice-white)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
          {decision.rationale}
        </p>
      </div>

      {/* Alternatives */}
      {decision.alternatives.length > 0 && (
        <div>
          <h4 style={{ fontSize: 11, fontWeight: 600, color: 'var(--cyan)', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Alternatives Considered
          </h4>
          <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
            {decision.alternatives.map((alt, i) => (
              <li key={i} style={{ fontSize: 12, color: 'var(--frost)', marginBottom: 4, lineHeight: 1.5 }}>
                {alt}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Thread link */}
      {decision.thread_id && (
        <button
          onClick={() => onOpenThread(decision.thread_id!)}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid var(--shadow)',
            background: 'var(--elevated)',
            color: 'var(--cyan)',
            cursor: 'pointer',
            fontSize: 11,
            textAlign: 'left',
            marginTop: 4,
          }}
        >
          🔗 Open source conversation
        </button>
      )}
    </div>
  );
}
