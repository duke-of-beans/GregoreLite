/**
 * Built-in Commands — Sprint S9-02
 *
 * All day-1 command definitions. Registered on app boot via registerBuiltins().
 * Actions reference store methods or navigation helpers.
 */

import { registerCommands, type CommandDef } from './index';
import { useUIStore } from '@/lib/stores/ui-store';
import { useThreadTabsStore } from '@/lib/stores/thread-tabs-store';

/**
 * Register all built-in commands. Called once on app boot (e.g. in layout or
 * ChatInterface mount). Safe to call multiple times — commands overwrite by id.
 */
export function registerBuiltins(): void {
  const commands: CommandDef[] = [
    // ── Navigation ──────────────────────────────────────────────────────────
    {
      id: 'nav.strategic',
      label: 'Switch to Strategic',
      category: 'Navigation',
      keywords: ['strategic', 'chat', 'main', 'thread'],
      icon: '★',
      action: () => {
        document.querySelector<HTMLButtonElement>('[data-tab="strategic"]')?.click();
      },
    },
    {
      id: 'nav.workers',
      label: 'Switch to Workers',
      category: 'Navigation',
      shortcut: 'Cmd+Shift+W',
      keywords: ['workers', 'jobs', 'queue', 'shim'],
      icon: '⚙',
      action: () => {
        document.querySelector<HTMLButtonElement>('[data-tab="workers"]')?.click();
      },
    },
    {
      id: 'nav.warroom',
      label: 'Switch to War Room',
      category: 'Navigation',
      shortcut: 'Cmd+W',
      keywords: ['war room', 'dependencies', 'graph', 'map'],
      icon: '🗺',
      action: () => {
        document.querySelector<HTMLButtonElement>('[data-tab="warroom"]')?.click();
      },
    },

    // ── Thread ───────────────────────────────────────────────────────────────
    {
      id: 'thread.new',
      label: 'New Thread',
      category: 'Thread',
      shortcut: 'Cmd+N',
      keywords: ['new', 'thread', 'tab', 'create'],
      icon: '+',
      action: () => {
        useThreadTabsStore.getState().createTab();
      },
    },
    {
      id: 'thread.close',
      label: 'Close Current Thread',
      category: 'Thread',
      keywords: ['close', 'thread', 'tab', 'remove'],
      icon: '×',
      action: () => {
        const store = useThreadTabsStore.getState();
        if (store.activeTabId) store.closeTab(store.activeTabId);
      },
      available: () => useThreadTabsStore.getState().tabs.length > 1,
    },
    {
      id: 'thread.rename',
      label: 'Rename Thread',
      category: 'Thread',
      keywords: ['rename', 'thread', 'title', 'tab'],
      icon: '✎',
      action: () => {
        const tabId = useThreadTabsStore.getState().activeTabId;
        if (tabId) {
          document
            .querySelector<HTMLSpanElement>(`[data-tab-id="${tabId}"] .tab-title`)
            ?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        }
      },
    },

    // ── Jobs ─────────────────────────────────────────────────────────────────
    {
      id: 'jobs.spawn',
      label: 'Spawn Job',
      category: 'Jobs',
      keywords: ['spawn', 'job', 'manifest', 'task', 'shim'],
      icon: '🚀',
      action: () => {
        useUIStore.getState().openModal('manifest-builder');
      },
      available: () => {
        const el = document.querySelector(
          '[data-tab="strategic"].active, [data-tab="strategic"][aria-selected="true"]'
        );
        return el !== null;
      },
    },
    {
      id: 'jobs.viewall',
      label: 'View All Jobs',
      category: 'Jobs',
      keywords: ['jobs', 'queue', 'workers', 'view'],
      icon: '📋',
      action: () => {
        document.querySelector<HTMLButtonElement>('[data-tab="workers"]')?.click();
      },
    },

    // ── Ghost ────────────────────────────────────────────────────────────────
    {
      id: 'ghost.privacy',
      label: 'Open Privacy Dashboard',
      category: 'Ghost',
      keywords: ['privacy', 'ghost', 'dashboard', 'sources'],
      icon: '👻',
      action: () => {
        useUIStore.getState().openModal('privacy-dashboard');
      },
    },
    {
      id: 'ghost.context',
      label: 'Open Context Library',
      category: 'Ghost',
      keywords: ['context', 'library', 'ghost', 'intelligence'],
      icon: '📚',
      action: () => {
        useUIStore.getState().setSidebarOpen(true);
      },
    },

    // ── Settings ─────────────────────────────────────────────────────────────
    {
      id: 'settings.open',
      label: 'Open Settings',
      category: 'Settings',
      shortcut: 'Cmd+,',
      keywords: ['settings', 'preferences', 'config'],
      icon: '⚙',
      action: () => {
        useUIStore.getState().openModal('settings');
      },
    },
    {
      id: 'settings.theme',
      label: 'Toggle Theme',
      category: 'Settings',
      keywords: ['theme', 'dark', 'light', 'toggle', 'mode'],
      icon: '🌗',
      action: () => {
        useUIStore.getState().toggleTheme();
      },
    },
    {
      id: 'settings.inspector',
      label: 'Open Inspector',
      category: 'Settings',
      shortcut: 'Cmd+I',
      keywords: ['inspector', 'debug', 'drawer'],
      icon: '🔍',
      action: () => {
        useUIStore.getState().openModal('inspector');
      },
    },

    // ── Decision Browser (S9-16) ───────────────────────────────────────────
    {
      id: 'app.decisions',
      label: 'Browse Decisions',
      category: 'Navigation',
      shortcut: 'Cmd+D',
      keywords: ['decisions', 'browse', 'rationale', 'alternatives', 'impact'],
      icon: '📋',
      action: () => {
        useUIStore.getState().openModal('decisions');
      },
    },

    // ── Project Quick-Switcher (S9-19) ──────────────────────────────────────
    {
      id: 'project.switch',
      label: 'Switch Project…',
      category: 'Navigation',
      keywords: ['project', 'switch', 'change', 'active'],
      icon: '📁',
      action: () => {
        // Dispatch event that ProjectSection listens for to open the switcher
        document.dispatchEvent(new CustomEvent('greglite:open-project-switcher'));
      },
    },

    // ── Artifact Library (S9-17) ────────────────────────────────────────────
    {
      id: 'app.artifactLibrary',
      label: 'Browse Artifact Library',
      category: 'Navigation',
      shortcut: 'Cmd+L',
      keywords: ['artifacts', 'library', 'browse', 'code', 'snippets', 'files'],
      icon: '📦',
      action: () => {
        useUIStore.getState().openModal('artifact-library');
      },
    },

    // ── Chat History (S9-12) ───────────────────────────────────────────────
    {
      id: 'chat.history',
      label: 'Browse Chat History',
      category: 'Navigation',
      shortcut: 'Cmd+[',
      keywords: ['chat', 'history', 'conversations', 'browse', 'past', 'threads'],
      icon: '📜',
      action: () => {
        useUIStore.getState().openModal('chat-history');
      },
    },

    // ── S9-13: Settings ───────────────────────────────────────────────────────
    {
      id: 'app.settings',
      label: 'Open Settings',
      category: 'Navigation',
      shortcut: 'Cmd+,',
      keywords: ['settings', 'preferences', 'config', 'theme', 'budget', 'monitor'],
      icon: '⚙',
      action: () => {
        useUIStore.getState().openModal('settings');
      },
    },

    // ── Memory ────────────────────────────────────────────────────────────────
    {
      id: 'kernl.decisions',
      label: 'Browse Decisions',
      category: 'Memory',
      keywords: ['decisions', 'browse', 'history', 'memory'],
      icon: '⚖',
      action: () => {
        useUIStore.getState().openModal('decision-browser');
      },
    },
    {
      id: 'kernl.search',
      label: 'Search Memory',
      category: 'Memory',
      keywords: ['search', 'memory', 'decisions', 'patterns', 'find'],
      icon: '🔎',
      action: () => {
        useUIStore.getState().openModal('kernl-search');
      },
    },

    // ── Navigation (extras) ─────────────────────────────────────────────────
    {
      id: 'nav.briefing',
      label: 'Morning Briefing',
      category: 'Navigation',
      keywords: ['morning', 'briefing', 'daily', 'summary', 'start day'],
      icon: '☀️',
      action: () => {
        useUIStore.getState().openModal('morning-briefing');
      },
    },
  ];

  registerCommands(commands);
}