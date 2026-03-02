'use client';

/**
 * IndexedItemRow — Sprint 6G
 *
 * Single row in the indexed items list.
 * Shows: type icon, source (path or subject), date indexed, chunk count, delete button.
 */

import { useState } from 'react';

interface IndexedItem {
  id: string;
  source_type: string;
  source_path: string | null;
  source_account: string | null;
  chunk_count: number;
  indexed_at: number;
}

interface Props {
  item: IndexedItem;
  onDelete: (id: string) => Promise<void>;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

function FileIcon() {
  return (
    <svg className="w-4 h-4 text-blue-400 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg className="w-4 h-4 text-purple-400 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
    </svg>
  );
}

export function IndexedItemRow({ item, onDelete }: Props) {
  const [deleting, setDeleting] = useState(false);

  const label =
    item.source_path
      ? truncate(item.source_path.replace(/\\/g, '/').split('/').slice(-3).join('/'), 60)
      : '(unknown)';

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(item.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <tr className="border-b border-white/5 hover:bg-white/3 group">
      <td className="py-2 px-3 w-8">
        {item.source_type === 'email' ? <EmailIcon /> : <FileIcon />}
      </td>
      <td className="py-2 px-3 text-sm text-gray-200 font-mono max-w-xs truncate" title={item.source_path ?? ''}>
        {label}
      </td>
      <td className="py-2 px-3 text-xs text-gray-400 whitespace-nowrap">
        {formatDate(item.indexed_at)}
      </td>
      <td className="py-2 px-3 text-xs text-gray-400 text-right">
        {item.chunk_count}
      </td>
      <td className="py-2 px-3 text-right">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition-opacity"
          aria-label="Delete item"
        >
          {deleting ? '…' : 'Delete'}
        </button>
      </td>
    </tr>
  );
}
