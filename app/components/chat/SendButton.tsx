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

'use client';

export type SendButtonState =
  | 'normal' // [Send] - cyan
  | 'checking' // [◉ Checking] - animated
  | 'approved' // [✓ Send] - green tint
  | 'warning' // [⚠ Review] - amber
  | 'veto'; // [Override?] - red

export interface SendButtonProps {
  state: SendButtonState;
  onClick: () => void;
  disabled?: boolean | undefined;
  ghostMessage?: string | undefined; // For hover tooltip
}

export function SendButton({
  state,
  onClick,
  disabled = false,
  ghostMessage,
}: SendButtonProps) {
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

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`
        flex items-center gap-2 rounded-lg px-4 py-2 font-medium
        transition-all duration-150
        ${config.bgColor}
        ${config.hoverBg}
        ${config.textColor}
        ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
      `}
      aria-label={`${config.label} - Ghost state: ${state}`}
      title={ghostMessage || config.label}
    >
      {config.icon && <span>{config.icon}</span>}
      <span className="text-sm">{config.label}</span>
    </button>
  );
}
