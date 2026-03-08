'use client';
/**
 * InputField Component — Sprint 30.0
 *
 * Sprint 18.0: accepts children rendered inside the relative wrapper
 * (used by ShimmerOverlay to position itself over the textarea).
 * forwardRef exposes the textarea element to parent components.
 *
 * Sprint 30.0 additions:
 *  - Auto-expand up to 40vh; collapses back as content shrinks.
 *  - Smart list continuation: Enter on "1. text" continues numbering; Enter on
 *    empty list item breaks out. Same for "- ", "* ", "• " bullet lists.
 *  - Code block shortcut: typing ``` auto-inserts closing ``` on next line.
 *  - Height resets to minimum on send.
 */


import { ChangeEvent, KeyboardEvent, useRef, forwardRef, useImperativeHandle } from 'react';

export interface InputFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  /** Rendered inside the relative wrapper — used by ShimmerOverlay */
  children?: React.ReactNode;
}

export const InputField = forwardRef<HTMLTextAreaElement, InputFieldProps>(
  function InputField(
    {
      value,
      onChange,
      onSubmit,
      disabled = false,
      placeholder = 'Type message...',
      children,
    }: InputFieldProps,
    forwardedRef,
  ) {
    const internalRef = useRef<HTMLTextAreaElement>(null);

    // Merge forwarded ref with internal ref
    useImperativeHandle(forwardedRef, () => internalRef.current!, []);

    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      if (internalRef.current) {
        const maxHeight = typeof window !== 'undefined' ? window.innerHeight * 0.4 : 200;
        internalRef.current.style.height = 'auto';
        internalRef.current.style.height =
          `${Math.min(internalRef.current.scrollHeight, maxHeight)}px`;
      }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // ── Smart list continuation (Enter AND Shift+Enter both trigger) ────────
      if (e.key === 'Enter') {
        const textarea = internalRef.current;
        if (textarea) {
          const pos = textarea.selectionStart ?? value.length;
          const lineStart = value.lastIndexOf('\n', pos - 1) + 1;
          const currentLine = value.slice(lineStart, pos);

          // Numbered list: "1. " or "  2. " etc.
          const numberedMatch = currentLine.match(/^(\s*)(\d+)\.\s(.*)$/);
          if (numberedMatch) {
            e.preventDefault();
            const [, indent = '', num = '1', content = ''] = numberedMatch;
            if (!content.trim()) {
              // Empty item — break out: remove marker, cursor at line start
              const newValue = value.slice(0, lineStart) + value.slice(pos);
              onChange(newValue);
              setTimeout(() => textarea.setSelectionRange(lineStart, lineStart), 0);
            } else {
              // Continue: increment number (works for both Enter and Shift+Enter)
              const nextMarker = `${indent}${parseInt(num) + 1}. `;
              const newValue = value.slice(0, pos) + '\n' + nextMarker + value.slice(pos);
              onChange(newValue);
              setTimeout(() => {
                const newPos = pos + 1 + nextMarker.length;
                textarea.setSelectionRange(newPos, newPos);
              }, 0);
            }
            return;
          }

          // Bullet list: "- ", "* ", "• "
          const bulletMatch = currentLine.match(/^(\s*)([-*\u2022])\s(.*)$/);
          if (bulletMatch) {
            e.preventDefault();
            const [, indent = '', marker = '-', content = ''] = bulletMatch;
            if (!content.trim()) {
              // Empty item — break out
              const newValue = value.slice(0, lineStart) + value.slice(pos);
              onChange(newValue);
              setTimeout(() => textarea.setSelectionRange(lineStart, lineStart), 0);
            } else {
              // Continue with same bullet (works for both Enter and Shift+Enter)
              const nextMarker = `${indent}${marker} `;
              const newValue = value.slice(0, pos) + '\n' + nextMarker + value.slice(pos);
              onChange(newValue);
              setTimeout(() => {
                const newPos = pos + 1 + nextMarker.length;
                textarea.setSelectionRange(newPos, newPos);
              }, 0);
            }
            return;
          }
        }

        // Plain Enter (no Shift) = submit; Shift+Enter outside a list = natural newline
        if (!e.shiftKey) {
          e.preventDefault();
          if (value.trim() && !disabled) {
            onSubmit();
            // Reset height to minimum after send
            if (internalRef.current) {
              internalRef.current.style.height = 'auto';
            }
          }
          return;
        }
        // Shift+Enter outside a list: browser handles natural newline insertion
      }

      // ── Code block shortcut: third backtick → insert closing ``` ─────────
      if (e.key === '`' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        const textarea = internalRef.current;
        if (textarea) {
          const pos = textarea.selectionStart ?? 0;
          // Check that the two chars before cursor are already ``
          if (pos >= 2 && value.slice(pos - 2, pos) === '``') {
            e.preventDefault();
            const before = value.slice(0, pos - 2); // strip the two existing backticks
            const after = value.slice(pos);
            const newValue = before + '```\n```' + after;
            onChange(newValue);
            setTimeout(() => {
              // Cursor sits on the blank line between the two fences
              const newPos = before.length + 4; // 3 backticks + 1 newline
              textarea.setSelectionRange(newPos, newPos);
            }, 0);
          }
        }
      }
    };

    return (
      <div className="relative w-full">
        <textarea
          ref={internalRef}
          data-tour="chat-input"
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
          style={{ maxHeight: '40vh', position: 'relative', zIndex: 2 }}
          aria-label="Message input"
        />
        {/* Overlay slot — ShimmerOverlay renders here */}
        {children}
        {value.length > 500 && (
          <div className="absolute -bottom-6 right-0 text-xs text-[var(--mist)]">
            {value.length} characters
          </div>
        )}
      </div>
    );
  },
);
