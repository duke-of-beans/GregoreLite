'use client';
/**
 * Toast — Sprint S9-03
 *
 * Individual toast notification. Severity-colored with icon, title,
 * optional message, and dismiss button. Slide-in animation from right.
 */


import { useEffect, useRef } from 'react';
import type { Notification, NotificationType } from '@/lib/stores/ui-store';

interface ToastProps {
  notification: Notification;
  onDismiss: (id: string) => void;
}

const SEVERITY_CONFIG: Record<
  NotificationType,
  { icon: string; border: string; bg: string; iconBg: string }
> = {
  info: {
    icon: 'ℹ',
    border: 'border-[var(--cyan)]/40',
    bg: 'bg-[var(--cyan)]/5',
    iconBg: 'bg-[var(--cyan)]/20 text-[var(--cyan)]',
  },
  success: {
    icon: '✓',
    border: 'border-green-500/40',
    bg: 'bg-green-500/5',
    iconBg: 'bg-green-500/20 text-green-400',
  },
  warning: {
    icon: '⚠',
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/5',
    iconBg: 'bg-amber-500/20 text-amber-400',
  },
  error: {
    icon: '✕',
    border: 'border-red-500/40',
    bg: 'bg-red-500/5',
    iconBg: 'bg-red-500/20 text-red-400',
  },
};

export function Toast({ notification, onDismiss }: ToastProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cfg = SEVERITY_CONFIG[notification.type];

  // Slide-in animation on mount
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = 'translateX(120%)';
    el.style.opacity = '0';
    requestAnimationFrame(() => {
      el.style.transition = 'transform 300ms ease-out, opacity 300ms ease-out';
      el.style.transform = 'translateX(0)';
      el.style.opacity = '1';
    });
  }, []);

  const handleDismiss = () => {
    const el = ref.current;
    if (el) {
      el.style.transition = 'transform 200ms ease-in, opacity 200ms ease-in';
      el.style.transform = 'translateX(120%)';
      el.style.opacity = '0';
      setTimeout(() => onDismiss(notification.id), 200);
    } else {
      onDismiss(notification.id);
    }
  };

  const age = Date.now() - notification.timestamp;
  const timeLabel =
    age < 60_000
      ? 'just now'
      : age < 3_600_000
        ? `${Math.floor(age / 60_000)}m ago`
        : `${Math.floor(age / 3_600_000)}h ago`;

  return (
    <div
      ref={ref}
      className={`pointer-events-auto w-80 rounded-lg border ${cfg.border} ${cfg.bg} bg-[var(--elevated)] p-3 shadow-lg`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm font-bold ${cfg.iconBg}`}
        >
          {cfg.icon}
        </span>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--ice-white)]">{notification.title}</p>
          {notification.message && (
            <p className="mt-0.5 text-xs text-[var(--frost)]">{notification.message}</p>
          )}
          <span className="mt-1 block text-[10px] text-[var(--mist)]">{timeLabel}</span>
        </div>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className="shrink-0 text-[var(--mist)] transition-colors hover:text-[var(--ice-white)]"
          aria-label="Dismiss notification"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}