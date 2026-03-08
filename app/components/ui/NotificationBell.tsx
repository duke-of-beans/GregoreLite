'use client';
/**
 * NotificationBell — Sprint S9-03
 *
 * Bell icon with badge showing count of non-dismissed persistent notifications.
 * Click opens NotificationCenter dropdown.
 */


import { useState, useRef } from 'react';
import { useUIStore } from '@/lib/stores/ui-store';
import { NotificationCenter } from './NotificationCenter';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const notifications = useUIStore((s) => s.notifications);

  // Count non-dismissed persistent (no auto-dismiss duration)
  const badgeCount = notifications.filter((n) => !n.dismissed && !n.duration).length;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--shadow)] bg-[var(--elevated)] text-[var(--frost)] transition-colors hover:border-[var(--cyan)] hover:text-[var(--ice-white)]"
        aria-label={`Notifications${badgeCount > 0 ? ` (${badgeCount} unread)` : ''}`}
        title="Notifications"
      >
        <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Badge */}
        {badgeCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      {open && <NotificationCenter onClose={() => setOpen(false)} />}
    </div>
  );
}