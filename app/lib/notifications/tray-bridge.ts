/**
 * Tray Bridge — Sprint S9-15
 *
 * Listens to ui-store notification events. When a notification has
 * escalate: true, it calls Tauri IPC to fire a Windows native toast
 * and updates the tray badge count.
 *
 * Escalated events:
 * - Job CI passed (PR ready to merge)
 * - Job failed permanently
 * - Budget hard cap reached
 * - Ghost critical interrupt
 */

'use client';

import { useUIStore } from '@/lib/stores/ui-store';

// ── Tauri IPC helpers (safe no-ops when not in Tauri) ────────────────────────

async function invokeTauri(cmd: string, args: Record<string, unknown>): Promise<void> {
  try {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke(cmd, args);
    }
  } catch (err) {
    console.warn(`[tray-bridge] IPC ${cmd} failed:`, err);
  }
}

async function sendNativeNotification(title: string, body: string, urgency: string): Promise<void> {
  await invokeTauri('send_notification', { title, body, urgency });
}

async function setTrayBadge(count: number): Promise<void> {
  await invokeTauri('set_tray_badge', { count });
}

// ── Bridge logic ─────────────────────────────────────────────────────────────

let lastNotificationCount = 0;

function handleNotificationsFromState(): void {
  const notifications = useUIStore.getState().notifications;
  const escalated = notifications.filter((n) => n.escalate && !n.dismissed);

  // Update tray badge
  const newCount = escalated.length;
  if (newCount !== lastNotificationCount) {
    lastNotificationCount = newCount;
    void setTrayBadge(newCount);
  }

  // Fire native toast for any new escalated notification
  // We track by checking the most recent escalated notification's timestamp
  for (const notif of escalated) {
    // Only fire toast for notifications created in the last 2 seconds (fresh)
    if (Date.now() - notif.timestamp < 2000) {
      void sendNativeNotification(
        notif.title,
        notif.message ?? '',
        notif.type === 'error' ? 'critical' : 'normal',
      );
    }
  }
}

// ── Budget hard-cap check (polls /api/settings every 30s) ────────────────────

let budgetInterval: ReturnType<typeof setInterval> | null = null;
let lastBudgetCapFired = false;

async function checkBudgetCap(): Promise<void> {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) return;
    const body = await res.json() as { data?: Record<string, string> };
    const cfg = body.data ?? {};
    const dailyCap = parseFloat(cfg.daily_hard_cap_usd ?? '15');
    // We need daily total — fetch from a lightweight endpoint
    const totalRes = await fetch('/api/agent-sdk/budget-status');
    if (!totalRes.ok) return;
    const totalBody = await totalRes.json() as { data?: { dailyTotalUsd?: number } };
    const dailyTotal = totalBody.data?.dailyTotalUsd ?? 0;

    if (dailyTotal >= dailyCap && !lastBudgetCapFired) {
      lastBudgetCapFired = true;
      useUIStore.getState().addNotification({
        type: 'error',
        title: 'Budget hard cap reached',
        message: `Daily spend $${dailyTotal.toFixed(2)} has reached the $${dailyCap.toFixed(2)} cap. New job spawns are blocked.`,
        escalate: true,
      });
    } else if (dailyTotal < dailyCap) {
      lastBudgetCapFired = false;
    }
  } catch {
    // Non-critical — skip this check cycle
  }
}

// ── Subscription (call once at app init) ─────────────────────────────────────

let unsubscribe: (() => void) | null = null;

export function startTrayBridge(): void {
  if (unsubscribe) return; // already running
  unsubscribe = useUIStore.subscribe(handleNotificationsFromState);
  // Start budget polling (every 30s)
  budgetInterval = setInterval(() => void checkBudgetCap(), 30_000);
  void checkBudgetCap(); // initial check
}

export function stopTrayBridge(): void {
  unsubscribe?.();
  unsubscribe = null;
  if (budgetInterval) {
    clearInterval(budgetInterval);
    budgetInterval = null;
  }
}
