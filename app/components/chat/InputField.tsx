/**
 * InputField Component
 * 
 * Message input with Ghost border glow (Layer 1 communication).
 * Part of Phase 5.0 P0 Foundation + Phase 5.2 P2 Memory System.
 * 
 * Spec: docs/UI_UX_FINAL_DIRECTION.md Part 2.1 (Layer 1 - Ambient Awareness)
 * Spec: docs/UI_UX_FINAL_DIRECTION.md Part 4.1 (Inline Memory Discovery)
 * Design: docs/DESIGN_SYSTEM.md Part 3 (Input Field States)
 */

'use client';

import { ChangeEvent, KeyboardEvent, useRef, useState } from 'react';
import { MemoryModal } from './MemoryModal';
import { MemoryIndicator } from './MemoryIndicator';
import type { MemoryMatch } from './MemoryShimmer';

export interface InputFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isGhostAnalyzing?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onMemorySelect?: (memoryIds: string[]) => void; // Callback when user selects memories
}

export function InputField({
  value,
  onChange,
  onSubmit,
  isGhostAnalyzing = false,
  disabled = false,
  placeholder = 'Type message...',
  onMemorySelect,
}: InputFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [memoryModalOpen, setMemoryModalOpen] = useState(false);
  const [currentMatches, setCurrentMatches] = useState<MemoryMatch[]>([]);

  // Handle input changes
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSubmit();
      }
    }

    // Open memory modal on Cmd/Ctrl+M
    if ((e.metaKey || e.ctrlKey) && e.key === 'm' && currentMatches.length > 0) {
      e.preventDefault();
      setMemoryModalOpen(true);
    }
  };

  // Handle memory click from shimmer
  const handleMemoryClick = (matches: MemoryMatch[]) => {
    setCurrentMatches(matches);
    setMemoryModalOpen(true);
  };

  // Handle memory selection
  const handleUseMemory = (memoryIds: string[]) => {
    onMemorySelect?.(memoryIds);
    setMemoryModalOpen(false);
  };

  return (
    <div className="relative w-full">
      {/* Memory Indicator */}
      {value.trim().length > 3 && (
        <div className="mb-2">
          <MemoryIndicator text={value} onMemoryClick={handleMemoryClick} />
        </div>
      )}

      {/* Ghost Glow Indicator */}
      {isGhostAnalyzing && (
        <div
          className="absolute -top-1 left-0 right-0 h-0.5 bg-[var(--cyan-bright)]"
          style={{
            boxShadow: '0 0 8px var(--cyan-bright)',
          }}
          aria-label="Ghost is analyzing"
        />
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className={`
          w-full resize-none border-b-2 bg-transparent px-4 py-3
          text-[var(--ice-white)] placeholder-[var(--mist)]
          transition-all duration-300
          ${
            isGhostAnalyzing
              ? 'ghost-pulse border-[var(--cyan-bright)]'
              : 'border-[var(--cyan)] opacity-60 focus:border-[var(--cyan-bright)] focus:opacity-100'
          }
          disabled:cursor-not-allowed disabled:opacity-50
          focus:outline-none focus:shadow-[0_1px_0_0_var(--cyan)]
        `}
        rows={1}
        style={{
          maxHeight: '200px',
        }}
        aria-label="Message input"
      />

      {/* Character Counter (Optional) */}
      {value.length > 500 && (
        <div className="absolute -bottom-6 right-0 text-xs text-[var(--mist)]">
          {value.length} characters
        </div>
      )}

      {/* Memory Modal */}
      <MemoryModal
        isOpen={memoryModalOpen}
        onClose={() => setMemoryModalOpen(false)}
        matches={currentMatches}
        onUseMemory={handleUseMemory}
      />
    </div>
  );
}
