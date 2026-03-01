/**
 * MemoryModal Component
 * 
 * Click-to-expand modal for viewing and managing memories.
 * Part of Phase 5.2 P2 - Memory System.
 * 
 * Spec: docs/UI_UX_FINAL_DIRECTION.md Part 4.2 (Memory Click-to-Expand)
 * 
 * Shows single or multiple memory matches with controls.
 */

'use client';

import { useState, useEffect } from 'react';
import type { MemoryMatch } from './MemoryShimmer';

export interface Memory {
  id: string;
  content: string;
  conversationDate: string;
  conversationTitle?: string;
  timesUsed: number;
  lastUsed: string;
  privacy: 'automatic' | 'ask' | 'never' | 'suggest';
}

export interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  matches: MemoryMatch[];
  onUseMemory: (memoryIds: string[]) => void;
  onEditMemory?: (memoryId: string) => void;
  onDeleteMemory?: (memoryId: string) => void;
  onViewConversation?: (memoryId: string) => void;
}

export function MemoryModal({
  isOpen,
  onClose,
  matches,
  onUseMemory,
  onEditMemory,
  onDeleteMemory,
  onViewConversation,
}: MemoryModalProps) {
  const [selectedMemories, setSelectedMemories] = useState<Set<string>>(new Set());
  const [expandedMemory, setExpandedMemory] = useState<string | null>(null);

  if (!isOpen) return null;

  // Get unique memories from matches
  const uniqueMemories = getUniqueMemories(matches);
  const isSingleMemory = uniqueMemories.length === 1;

  // Auto-select if single memory (only on first render)
  useEffect(() => {
    if (isSingleMemory && selectedMemories.size === 0) {
      setSelectedMemories(new Set([uniqueMemories[0]!.id]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleMemory = (memoryId: string) => {
    const newSelected = new Set(selectedMemories);
    if (newSelected.has(memoryId)) {
      newSelected.delete(memoryId);
    } else {
      newSelected.add(memoryId);
    }
    setSelectedMemories(newSelected);
  };

  const handleUseSelected = () => {
    onUseMemory(Array.from(selectedMemories));
    onClose();
  };

  const handleUseAll = () => {
    onUseMemory(uniqueMemories.map(m => m.id));
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal"
      />

      {/* Modal - Inline style (like Cmd+F) */}
      <div
        className="fixed left-1/2 top-1/4 z-50 w-full max-w-2xl -translate-x-1/2 rounded-lg border border-[var(--shadow)] bg-[var(--elevated)] shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="memory-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--shadow)] px-6 py-4">
          <h2
            id="memory-modal-title"
            className="text-lg font-semibold text-[var(--ice-white)]"
          >
            {isSingleMemory ? 'Memory Match' : `Related Memories (${uniqueMemories.length})`}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--mist)] transition-colors hover:text-[var(--ice-white)]"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {isSingleMemory ? (
            /* Single Memory View */
            <>
              {uniqueMemories[0] && (
                <SingleMemoryView
                  memory={uniqueMemories[0]}
                  expanded={true}
                  {...(onEditMemory && { onEdit: onEditMemory })}
                  {...(onDeleteMemory && { onDelete: onDeleteMemory })}
                  {...(onViewConversation && { onViewConversation })}
                />
              )}
            </>
          ) : (
            /* Multiple Memories List */
            <div className="space-y-3">
              {uniqueMemories.map((memory) => (
                <label
                  key={memory.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--shadow)] bg-[var(--deep-space)]/30 p-4 transition-colors hover:border-[var(--cyan)]"
                >
                  <input
                    type="checkbox"
                    checked={selectedMemories.has(memory.id)}
                    onChange={() => handleToggleMemory(memory.id)}
                    className="mt-1 h-4 w-4 rounded border-[var(--shadow)] bg-[var(--deep-space)] text-[var(--cyan)] focus:ring-[var(--cyan)]"
                  />
                  <div className="flex-1">
                    <SingleMemoryView
                      memory={memory}
                      expanded={expandedMemory === memory.id}
                      onToggleExpand={() =>
                        setExpandedMemory(expandedMemory === memory.id ? null : memory.id)
                      }
                      {...(onEditMemory && { onEdit: onEditMemory })}
                      {...(onDeleteMemory && { onDelete: onDeleteMemory })}
                      {...(onViewConversation && { onViewConversation })}
                    />
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-[var(--shadow)] px-6 py-4">
          <button
            onClick={onClose}
            className="text-sm text-[var(--mist)] transition-colors hover:text-[var(--ice-white)]"
          >
            Ignore
          </button>
          <div className="flex gap-3">
            {!isSingleMemory && (
              <>
                <button
                  onClick={handleUseSelected}
                  disabled={selectedMemories.size === 0}
                  className="rounded-lg border border-[var(--cyan)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--cyan)] transition-colors hover:bg-[var(--cyan)]/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Use Selected ({selectedMemories.size})
                </button>
                <button
                  onClick={handleUseAll}
                  className="rounded-lg bg-[var(--cyan)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--cyan-dark)]"
                >
                  Use All
                </button>
              </>
            )}
            {isSingleMemory && (
              <button
                onClick={handleUseSelected}
                className="rounded-lg bg-[var(--cyan)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--cyan-dark)]"
              >
                Use This Context
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Single memory view component
 */
interface SingleMemoryViewProps {
  memory: Memory;
  expanded: boolean;
  onToggleExpand?: () => void;
  onEdit?: (memoryId: string) => void;
  onDelete?: (memoryId: string) => void;
  onViewConversation?: (memoryId: string) => void;
}

function SingleMemoryView({
  memory,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onViewConversation,
}: SingleMemoryViewProps) {
  const preview = memory.content.length > 150 ? `${memory.content.slice(0, 150)}...` : memory.content;

  return (
    <div className="space-y-2">
      {/* Preview/Full Content */}
      <div className="text-sm leading-relaxed text-[var(--ice-white)]">
        {expanded ? memory.content : preview}
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-[var(--mist)]">
        <span>From: {memory.conversationDate}</span>
        <span>Used {memory.timesUsed} times</span>
        <span>Last: {memory.lastUsed}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        {memory.content.length > 150 && (
          <button
            onClick={onToggleExpand}
            className="text-xs text-[var(--cyan)] transition-colors hover:text-[var(--cyan-light)]"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
        {onViewConversation && (
          <button
            onClick={() => onViewConversation(memory.id)}
            className="text-xs text-[var(--cyan)] transition-colors hover:text-[var(--cyan-light)]"
          >
            See full conversation
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(memory.id)}
            className="text-xs text-[var(--frost)] transition-colors hover:text-[var(--ice-white)]"
          >
            Edit
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(memory.id)}
            className="text-xs text-[var(--error)] transition-colors hover:text-[var(--error)]/80"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Get unique memories from matches
 * TODO: Fetch full memory objects from backend
 */
function getUniqueMemories(matches: MemoryMatch[]): Memory[] {
  const memoryMap = new Map<string, Memory>();

  for (const match of matches) {
    if (!memoryMap.has(match.memoryId)) {
      // Placeholder - will be replaced with real memory fetch
      memoryMap.set(match.memoryId, {
        id: match.memoryId,
        content: match.memoryPreview,
        conversationDate: 'Jan 12, 2026',
        conversationTitle: 'Project discussion',
        timesUsed: 3,
        lastUsed: '2 days ago',
        privacy: 'automatic',
      });
    }
  }

  return Array.from(memoryMap.values());
}
