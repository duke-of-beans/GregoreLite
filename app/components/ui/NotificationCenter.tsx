'use client';
/**
 * NotificationCenter — Sprint S9-03
 *
 * Dropdown panel showing all persistent (non-auto-dismissed) notifications
 * grouped by severity. Includes mark-all-read action.
 */


import { useUIStore, type Notification, type NotificationType } from '@/lib/stores/ui-store';

interface NotificationCenterProps {
  onClose: () => void;
}

const SEVERITY_ORDER: NotificationType[] = ['error', 'warning', 'info', 'success'];

const SEVERITY_LABELS: Record<NotificationType, { label: string; color: string }> = {
  error: { label: 'Errors', color: 'text-red-400' },
  warning: { label: 'Warnings', color: 'text-amber-400' },
  info: { label: 'Info', color: 'text-[var(--cyan)]' },
  success: { label: 'Success', color: 'text-green-400' },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function NotificationCenter({ onClose }: NotificationCenterProps) {
  const notifications = useUIStore((s) => s.notifications);
  const dismissNotification = useUIStore((s) => s.dismissNotification);
  const clearDismissedNotifications = useUIStore((s) => s.clearDismissedNotifications);

  // Only persistent (no duration) and not dismissed
  const persistent = notifications.filter((n) => !n.dismissed && !n.duration);

  const markAllRead = () => {
    persistent.forEach((n) => dismissNotification(n.id));
  };

  // Group by severity
  const groups: { type: NotificationType; items: Notification[] }[] = [];
  for (const sev of SEVERITY_ORDER) {
    const items = persistent.filter((n) => n.type === sev);
    if (items.length > 0) groups.push({ type: sev, items });
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-30" onClick={onClose} />

      {/* Dropdown */}
      <div className="absolute right-0 top-full z-40 mt-2 w-80 rounded-lg border border-[var(--shadow)] bg-[var(--elevated)] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--shadow)] px-4 py-3">
          <span className="text-sm font-semibold text-[var(--ice-white)]">Notifications</span>
          <div className="flex gap-2">
            {persistent.length > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-[var(--cyan)] hover:text-[var(--ice-white)]"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={() => {
                clearDismissedNotifications();
                onClose();
              }}
              className="text-xs text-[var(--mist)] hover:text-[var(--frost)]"
            >
              Clear old
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-80 overflow-y-auto">
          {groups.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-[var(--mist)]">
              No notifications
            </div>
          ) : (
            groups.map((group) => {
              const cfg = SEVERITY_LABELS[group.type];
              return (
                <div key={group.type}>
                  <div className={`px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider ${cfg.color}`}>
                    {cfg.label}
                  </div>
                  {group.items.map((n) => (
                    <div
                      key={n.id}
                      className="flex items-start gap-2 px-4 py-2 hover:bg-[var(--surface)]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-[var(--ice-white)]">{n.title}</p>
                        {n.message && (
                          <p className="text-xs text-[var(--frost)]">{n.message}</p>
                        )}
                        <span className="text-[10px] text-[var(--mist)]">
                          {formatTime(n.timestamp)}
                        </span>
                      </div>
                      <button
                        onClick={() => dismissNotification(n.id)}
                        className="shrink-0 pt-0.5 text-[var(--mist)] hover:text-[var(--ice-white)]"
                        aria-label="Dismiss"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}