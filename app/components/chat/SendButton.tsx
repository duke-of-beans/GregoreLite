'use client';
/**
 * SendButton Component
 * 
 * 5-state send button (Ghost Layer 2 communication).
 * Part of Phase 5.0 P0 Foundation.
 * 
 * States: normal | checking | approved | warning | veto
 * 
 * Spec: docs/UI_UX_FINAL_DIRECTION.md Part 2.2 (Layer 2 - Action Clarity)
 * Design: docs/DESIGN_SYSTEM.md Part 3 (Send Button Component)
 */


import { motion } from 'framer-motion';
import { buttonPress } from '@/lib/design/animations';

export type SendButtonState =
  | 'normal' // [Send] - cyan
  | 'checking' // [◉ Checking] - animated
  | 'approved' // [✓ Send] - green tint
  | 'warning' // [⚠ Review] - amber
  | 'veto' // [Override?] - red
  | 'streaming'; // [Stop] - red square

export interface SendButtonProps {
  state: SendButtonState;
  onClick: () => void;
  onStop?: () => void;
  disabled?: boolean | undefined;
  ghostMessage?: string | undefined; // For hover tooltip
}

export function SendButton({
  state,
  onClick,
  onStop,
  disabled = false,
  ghostMessage,
}: SendButtonProps) {
  // Streaming state — special render (stop button)
  if (state === 'streaming') {
    return (
      <button
        onClick={onStop}
        className="flex items-center justify-center h-9 w-9 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30 transition-colors"
        title="Stop generating"
        aria-label="Stop generating"
        data-send-button
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
          <rect x="2" y="2" width="8" height="8" rx="1" />
        </svg>
      </button>
    );
  }

  // State-specific configuration
  const stateConfig = {
    normal: {
      label: 'Send',
      icon: null,
      bgColor: 'bg-[var(--cyan)]',
      hoverBg: 'hover:bg-[var(--cyan-dark)]',
      textColor: 'text-white',
    },
    checking: {
      label: 'Checking',
      icon: (
        <svg
          className="spin h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ),
      bgColor: 'bg-[var(--cyan)]',
      hoverBg: '',
      textColor: 'text-white opacity-80',
    },
    approved: {
      label: 'Send',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      ),
      bgColor: 'bg-gradient-to-br from-[var(--cyan)] to-[var(--success)]',
      hoverBg: 'hover:opacity-90',
      textColor: 'text-white',
    },
    warning: {
      label: 'Review',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
      bgColor: 'bg-[var(--warning)]',
      hoverBg: 'hover:opacity-90',
      textColor: 'text-white',
    },
    veto: {
      label: 'Override?',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      ),
      bgColor: 'bg-[var(--error)]',
      hoverBg: 'hover:opacity-90',
      textColor: 'text-white',
    },
  };

  const config = stateConfig[state];
  const isDisabled = disabled || state === 'checking';

  // Primary action states (normal, approved) get spring micro-interactions.
  // Secondary/warning states keep a plain button — no bounce on dangerous actions.
  const isPrimary = state === 'normal' || state === 'approved';

  const sharedClassName = `
    flex items-center gap-2 rounded-lg px-4 py-2 font-medium
    transition-all duration-150
    ${config.bgColor}
    ${config.hoverBg}
    ${config.textColor}
    ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
  `;

  const sharedProps = {
    onClick,
    disabled: isDisabled,
    className: sharedClassName,
    'aria-label': `${config.label} - Ghost state: ${state}`,
    title: ghostMessage || config.label,
    'data-send-button': true,
  } as const;

  const children = (
    <>
      {config.icon && <span>{config.icon}</span>}
      <span className="text-sm">{config.label}</span>
    </>
  );

  if (isPrimary) {
    return (
      <motion.button {...sharedProps} {...buttonPress}>
        {children}
      </motion.button>
    );
  }

  return (
    <button {...sharedProps}>
      {children}
    </button>
  );
}
