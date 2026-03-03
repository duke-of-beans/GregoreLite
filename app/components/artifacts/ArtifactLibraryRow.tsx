/**
 * ArtifactLibraryRow — S9-17
 * Single row in the artifact library: type badge, title, language, date.
 */

'use client';

const typeIcons: Record<string, string> = {
  file: '📄',
  snippet: '✂️',
  diagram: '📊',
  plan: '📋',
  markdown: '📝',
};

interface ArtifactItem {
  id: string;
  type: string;
  title: string;
  language: string | null;
  created_at: number;
  project_name: string | null;
  contentPreview: string;
}

interface Props {
  artifact: ArtifactItem;
  selected: boolean;
  onClick: () => void;
}

export function ArtifactLibraryRow({ artifact, selected, onClick }: Props) {
  const date = new Date(artifact.created_at);
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
      <span style={{ fontSize: 14, flexShrink: 0 }}>{typeIcons[artifact.type] ?? '📄'}</span>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{
          fontSize: 12,
          color: selected ? 'var(--ice-white)' : 'var(--frost)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {artifact.title}
        </div>
        <div style={{ fontSize: 10, color: 'var(--shadow)', marginTop: 2 }}>
          {artifact.language && <span>{artifact.language} · </span>}
          {artifact.project_name && <span>{artifact.project_name} · </span>}
          {dateStr}
        </div>
      </div>
    </button>
  );
}