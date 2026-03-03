/**
 * ToastStack — Sprint S9-03
 *
 * Fixed-position bottom-right toast renderer. Reads from ui-store.notifications.
 * Shows max 4 visible toasts. Older ones pushed off. Z-index above all panels
 * but below command palette (z-50).
 */

'use client';

import { useUIStore } from '@/lib/stores/ui-store';
import { Toast } from './Toast';

const MAX_VISIBLE = 4;

export function ToastStack() {
  const notifications = useUIStore((s) => s.notifications);
  const dismissNotification = useUIStore((s) => s.dismissNotification);

  // Show non-dismissed, most recent first, max 4
  const visible = notifications
    .filter((n) => !n.dismissed)
    .slice(0, MAX_VISIBLE);

  if (visible.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-40 flex flex-col-reverse gap-2"
      aria-live="polite"
      aria-label="Notifications"
    >
      {visible.map((n) => (
        <Toast key={n.id} notification={n} onDismiss={dismissNotification} />
      ))}
    </div>
  );
}