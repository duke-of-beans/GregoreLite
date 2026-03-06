/**
 * InputField Component
 *
 * Message input for GregLite strategic thread.
 * Sprint 18.0: accepts children rendered inside the relative wrapper
 * (used by ShimmerOverlay to position itself over the textarea).
 * forwardRef exposes the textarea element to parent components.
 */

'use client';

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
        internalRef.current.style.height = 'auto';
        internalRef.current.style.height = `${internalRef.current.scrollHeight}px`;
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
          ref={internalRef}
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
          style={{ maxHeight: '200px', position: 'relative', zIndex: 2 }}
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
