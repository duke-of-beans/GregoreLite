/**
 * Thread Tabs — KERNL persistence helpers
 *
 * Sprint S9-01: Multi-Thread Tabs
 *
 * Read/write helpers for persisting tab state to the KERNL settings table.
 * Tab layout is stored as a JSON blob under the 'thread_tabs' settings key.
 * Individual tab message state is recovered from KERNL threads on reload.
 */

export interface PersistedTab {
  id: string;
  kernlThreadId: string;
  conversationId: string | null;
  title: string;
}

export interface PersistedTabLayout {
  tabs: PersistedTab[];
  activeTabId: string;
}

/**
 * Save current tab layout to KERNL settings table via API.
 */
export async function saveTabLayout(layout: PersistedTabLayout): Promise<void> {
  try {
    await fetch('/api/settings/thread-tabs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(layout),
    });
  } catch {
    console.warn('[thread-tabs] Failed to persist tab layout');
  }
}

/**
 * Load tab layout from KERNL settings table via API.
 * Returns null if no layout has been saved (first boot).
 */
export async function loadTabLayout(): Promise<PersistedTabLayout | null> {
  try {
    const res = await fetch('/api/settings/thread-tabs');
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Restore messages for a given KERNL thread ID via the restore API.
 * Returns restored messages or empty array if nothing to restore.
 */
export async function restoreTabMessages(
  threadId: string
): Promise<{ role: 'user' | 'assistant'; content: string; timestamp: number }[]> {
  try {
    const res = await fetch(`/api/restore?threadId=${encodeURIComponent(threadId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data?.data?.messages ?? [];
  } catch {
    return [];
  }
}
