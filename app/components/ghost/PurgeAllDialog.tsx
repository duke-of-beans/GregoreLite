'use client';

import { useCallback, useRef, useState } from 'react';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PurgeAllDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PurgeAllDialog({ open, onClose, onSuccess }: PurgeAllDialogProps) {
  const [confirmation, setConfirmation] = useState('');
  const [purging,      setPurging]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const REQUIRED_TEXT = 'DELETE';
  const canPurge = confirmation === REQUIRED_TEXT && !purging;

  // Reset state when closed
  const handleClose = useCallback(() => {
    if (purging) return; // don't close mid-purge
    setConfirmation('');
    setError(null);
    onClose();
  }, [purging, onClose]);

  // Execute purge
  const handlePurge = useCallback(async () => {
    if (!canPurge) return;
    setPurging(true);
    setError(null);
    try {
      const res = await fetch('/api/ghost/purge', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setConfirmation('');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purge failed');
    } finally {
      setPurging(false);
    }
  }, [canPurge, onSuccess, onClose]);

  if (!open) return null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl p-6">

        {/* Icon */}
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mx-auto mb-4">
          <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        {/* Heading */}
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 text-center mb-2">
          Purge all Ghost data
        </h2>

        {/* Warning body */}
        <div className="text-sm text-gray-600 dark:text-gray-400 text-center space-y-2 mb-5">
          <p>
            This will permanently delete <strong className="text-gray-800 dark:text-gray-200">all indexed items</strong>,
            content chunks, vector embeddings, surfaced suggestions, and the exclusion log.
          </p>
          <p>
            Your <strong className="text-gray-800 dark:text-gray-200">exclusion rules</strong> (Layer 4) will be kept.
            Ghost will restart and begin re-indexing from scratch.
          </p>
          <p className="text-red-600 dark:text-red-400 font-medium">This action cannot be undone.</p>
        </div>

        {/* Confirmation input */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Type <span className="font-mono font-bold">{REQUIRED_TEXT}</span> to confirm
          </label>
          <input
            ref={inputRef}
            type="text"
            value={confirmation}
            onChange={e => setConfirmation(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && canPurge) handlePurge(); }}
            autoFocus
            spellCheck={false}
            disabled={purging}
            className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            disabled={purging}
            className="flex-1 px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePurge}
            disabled={!canPurge}
            className="flex-1 px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-40 transition-colors"
          >
            {purging ? 'Purging…' : 'Purge all data'}
          </button>
        </div>
      </div>
    </div>
  );
}
