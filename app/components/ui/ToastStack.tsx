/**
 * ToastStack — Sprint S9-03
 *
 * Fixed-position bottom-right toast renderer. Reads from ui-store.notifications.
 * Shows max 4 visible toasts. Older ones pushed off. Z-index above all panels
 * but below command palette (z-50).
 *
 * Sprint 19.0 — Law 5: each notification is checked against the interrupt gate
 * before rendering. Notifications blocked during deep work are queued and
 * released automatically when focus drops.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useUIStore } from '@/lib/stores/ui-store';
import { Toast } from './Toast';
import { shouldInterrupt, onQueueDrain } from '@/lib/focus/interrupt-gate';

const MAX_VISIBLE = 4;

export function ToastStack() {
  const notifications = useUIStore((s) => s.notifications);
  const dismissNotification = useUIStore((s) => s.dismissNotification);

  // IDs approved by the interrupt gate (checked once per notification)
  const [gatedIds, setGatedIds] = useState<Set<string>>(new Set());
  const checkedIds = useRef<Set<string>>(new Set());

  // Check each new notification against the interrupt gate (once on arrival)
  useEffect(() => {
    const newIds: string[] = [];
    for (const n of notifications) {
      if (n.dismissed || checkedIds.current.has(n.id)) continue;
      checkedIds.current.add(n.id);
      const allowed = shouldInterrupt({
        type: 'notification',
        severity: 'medium',
        message: n.message ?? n.title,
        id: n.id,
      });
      if (allowed) newIds.push(n.id);
      // else: interrupt gate queued it; drain handler will surface it
    }
    if (newIds.length > 0) {
      setGatedIds((prev) => new Set([...prev, ...newIds]));
    }
  }, [notifications]);

  // Release queued notifications when focus transitions downward
  useEffect(() => {
    return onQueueDrain((released) => {
      const releaseIds: string[] = [];
      for (const r of released) {
        if (r.type === 'notification' && r.id !== undefined) {
          releaseIds.push(r.id);
        }
      }
      if (releaseIds.length > 0) {
        setGatedIds((prev) => new Set([...prev, ...releaseIds]));
      }
    });
  }, []);

  // Show gate-approved, non-dismissed notifications — most recent first, max 4
  const visible = notifications
    .filter((n) => !n.dismissed && gatedIds.has(n.id))
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