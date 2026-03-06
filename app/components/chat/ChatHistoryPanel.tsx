/**
 * ChatHistoryPanel — Sprint S9-12
 *
 * Left slide-in drawer showing past conversations. Triggered by Cmd+[
 * or command palette. Two sections: Pinned conversations, Recent (last 50).
 * Search by title at top. Click loads thread into current tab.
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useConversationStore } from '@/lib/stores/conversation-store';
import type { ConversationWithStats } from '@/lib/api/conversation-client';
import { listConversations as apiListConversations } from '@/lib/api/conversation-client';
import { HistoryRow } from './HistoryRow';

interface ChatHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  onLoadThread: (conversationId: string) => void;
}

export function ChatHistoryPanel({ open, onClose, onLoadThread }: ChatHistoryPanelProps) {
  const {
    loadConversations,
    searchConversations,
    updateTitle,
    archiveConversation,
    pinConversation,
    unpinConversation,
    listCache,
    searchCache,
    isLoading,
  } = useConversationStore();

  const [query, setQuery] = useState('');
  const [pinnedConvs, setPinnedConvs] = useState<ConversationWithStats[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load conversations on open
  useEffect(() => {
    if (open) {
      void loadConversations();
      // Also load pinned separately
      void loadPinned();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadPinned = useCallback(async () => {
    try {
      const result = await apiListConversations({ pinned: true, page: 1, pageSize: 50 });
      setPinnedConvs(result.items);
    } catch {
      // non-blocking — pinned section degrades gracefully
    }
  }, []);

  // Keyboard: Escape closes
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Debounced search
  function handleSearchChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length === 0) {
      void loadConversations();
      return;
    }
    debounceRef.current = setTimeout(() => {
      void searchConversations(value.trim());
    }, 250);
  }

  function handleLoadThread(conversationId: string) {
    onLoadThread(conversationId);
    onClose();
  }

  async function handleRename(id: string, newTitle: string) {
    await updateTitle(id, newTitle);
    void loadConversations();
    void loadPinned();
  }

  async function handleArchive(id: string) {
    await archiveConversation(id);
    void loadConversations();
    void loadPinned();
  }

  async function handlePin(id: string) {
    await pinConversation(id);
    void loadConversations();
    void loadPinned();
  }

  async function handleUnpin(id: string) {
    await unpinConversation(id);
    void loadConversations();
    void loadPinned();
  }

  // Determine which conversations to show
  const searchResults = query.trim() ? searchCache.get(query.trim()) : null;
  const conversations: ConversationWithStats[] = searchResults
    ? searchResults.items
    : (listCache?.items ?? []);

  // Filter out archived from main list (unless searching)
  const recentConvs = conversations.filter((c) => !c.archived && !c.pinned);
  const pinnedIds = new Set(pinnedConvs.map((c) => c.id));

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 199,
            background: 'rgba(0,0,0,0.5)',
          }}
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '360px',
          zIndex: 200,
          background: 'var(--deep-space, #0a0e17)',
          borderRight: '1px solid var(--border)',
          boxShadow: '4px 0 16px rgba(0,0,0,0.3)',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.2s ease-in-out',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 14px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--frost)', letterSpacing: '0.06em' }}>
            CHAT HISTORY
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--mist)',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '0 4px',
            }}
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '8px 12px', flexShrink: 0 }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search conversations..."
            style={{
              width: '100%',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              color: 'var(--frost)',
              fontSize: '12px',
              padding: '6px 10px',
              outline: 'none',
            }}
          />
        </div>

        {/* Scrollable list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {isLoading && conversations.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', fontSize: '11px', color: 'var(--mist)' }}>
              Loading...
            </div>
          )}

          {/* Pinned section */}
          {!query.trim() && pinnedConvs.length > 0 && (
            <>
              <div style={{
                fontSize: '9px',
                color: 'var(--mist)',
                letterSpacing: '0.1em',
                padding: '8px 14px 4px',
              }}>
                PINNED
              </div>
              {pinnedConvs.map((conv) => (
                <HistoryRow
                  key={conv.id}
                  id={conv.id}
                  title={conv.title}
                  messageCount={conv.messageCount}
                  lastMessageAt={conv.lastMessageAt}
                  pinned={conv.pinned}
                  archived={conv.archived}
                  onClick={handleLoadThread}
                  onRename={handleRename}
                  onArchive={handleArchive}
                  onPin={handlePin}
                  onUnpin={handleUnpin}
                />
              ))}
            </>
          )}

          {/* Recent section */}
          {recentConvs.length > 0 && (
            <>
              <div style={{
                fontSize: '9px',
                color: 'var(--mist)',
                letterSpacing: '0.1em',
                padding: '8px 14px 4px',
              }}>
                {query.trim() ? 'SEARCH RESULTS' : 'RECENT'}
              </div>
              {recentConvs.map((conv) => (
                <HistoryRow
                  key={conv.id}
                  id={conv.id}
                  title={conv.title}
                  messageCount={conv.messageCount}
                  lastMessageAt={conv.lastMessageAt}
                  pinned={pinnedIds.has(conv.id)}
                  archived={conv.archived}
                  onClick={handleLoadThread}
                  onRename={handleRename}
                  onArchive={handleArchive}
                  onPin={handlePin}
                  onUnpin={handleUnpin}
                />
              ))}
            </>
          )}

          {!isLoading && conversations.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', fontSize: '11px', color: 'var(--mist)', fontStyle: 'italic' }}>
              {query.trim() ? 'No matching conversations' : 'No conversations yet'}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
