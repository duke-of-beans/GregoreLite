/**
 * ThreadTabBar — Horizontal tab strip for multi-thread strategic tabs.
 *
 * Sprint S9-01: Multi-Thread Tabs
 *
 * Renders inside the strategic tab area, below the main tab bar.
 * Shows all open thread tabs with a [+] button to create new ones.
 * Only visible when activeTab === 'strategic'.
 */

'use client';

import {
  useThreadTabsStore,
  selectIsAtTabLimit,
  selectIsNearTabLimit,
} from '@/lib/stores/thread-tabs-store';
import { useDecisionGateStore } from '@/lib/stores/decision-gate-store';
import { ThreadTab } from './ThreadTab';

export function ThreadTabBar() {
  const tabs = useThreadTabsStore((s) => s.tabs);
  const activeTabId = useThreadTabsStore((s) => s.activeTabId);
  const setActiveTab = useThreadTabsStore((s) => s.setActiveTab);
  const createTab = useThreadTabsStore((s) => s.createTab);
  const closeTab = useThreadTabsStore((s) => s.closeTab);
  const renameTab = useThreadTabsStore((s) => s.renameTab);
  const atLimit = useThreadTabsStore(selectIsAtTabLimit);
  const nearLimit = useThreadTabsStore(selectIsNearTabLimit);
  const gateTrigger = useDecisionGateStore((s) => s.trigger);

  const handleCreate = () => {
    if (!atLimit) {
      void createTab();
    }
  };

  if (tabs.length <= 1) {
    // Single tab — don't render the bar, saves vertical space
    return null;
  }

  return (
    <div className="flex items-center bg-[var(--elevated)] border-b border-[var(--shadow)] overflow-x-auto flex-shrink-0">
      {tabs.map((tab) => (
        <ThreadTab
          key={tab.id}
          id={tab.id}
          title={tab.title}
          active={tab.id === activeTabId}
          ghostActive={tab.ghostContextActive !== null}
          gateActive={
            tab.id === activeTabId && gateTrigger !== null
          }
          closable={tabs.length > 1}
          onSelect={() => setActiveTab(tab.id)}
          onClose={() => closeTab(tab.id)}
          onRename={(title) => renameTab(tab.id, title)}
        />
      ))}

      {/* New tab button */}
      <button
        className={[
          'flex items-center justify-center h-7 w-7 ml-1 rounded text-xs transition-colors flex-shrink-0',
          atLimit
            ? 'text-[var(--mist)] opacity-40 cursor-not-allowed'
            : 'text-[var(--mist)] hover:text-[var(--ice-white)] hover:bg-[var(--shadow)]',
        ].join(' ')}
        onClick={handleCreate}
        disabled={atLimit}
        aria-label="New thread tab (Cmd+N)"
        title={
          atLimit
            ? `Maximum ${8} tabs reached`
            : nearLimit
              ? `${tabs.length}/8 tabs open — New tab (Cmd+N)`
              : 'New tab (Cmd+N)'
        }
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Near-limit warning */}
      {nearLimit && !atLimit && (
        <span className="text-[9px] text-[var(--amber)] ml-2 flex-shrink-0 pr-2">
          {tabs.length}/8
        </span>
      )}
    </div>
  );
}
