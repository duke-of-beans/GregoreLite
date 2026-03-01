/**
 * InputField Component
 *
 * Message input for GregLite strategic thread.
 * Phase 1 foundation — Memory shimmer/indicator wired in Phase 3.
 */

'use client';

import { ChangeEvent, KeyboardEvent, useRef } from 'react';

export interface InputFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function InputField({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = 'Type message...',
}: InputFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSubmit();
      }
    }
  };

  return (
    <div className="relative w-full">
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
          border-[var(--cyan)] opacity-60 focus:border-[var(--cyan-bright)] focus:opacity-100
          disabled:cursor-not-allowed disabled:opacity-50
          focus:outline-none focus:shadow-[0_1px_0_0_var(--cyan)]
        `}
        rows={1}
        style={{ maxHeight: '200px' }}
        aria-label="Message input"
      />
      {value.length > 500 && (
        <div className="absolute -bottom-6 right-0 text-xs text-[var(--mist)]">
          {value.length} characters
        </div>
      )}
    </div>
  );
}
