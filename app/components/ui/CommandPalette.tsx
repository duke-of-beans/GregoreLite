'use client';
/**
 * CommandPalette — Sprint S9-02
 *
 * Modal overlay triggered by Cmd+K. Fuzzy-searches the command registry.
 * Shows recent commands when query is empty. Arrow keys navigate, Enter
 * executes. Grouped by category with visual headers.
 */


import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useUIStore } from '@/lib/stores/ui-store';
import { searchCommands, onRegistryChange, type CommandDef, type CommandCategory } from '@/lib/command-registry';
import { CommandResult } from './CommandResult';

// ── Category display order ────────────────────────────────────────────────────

const CATEGORY_ORDER: CommandCategory[] = [
  'Navigation',
  'Thread',
  'Jobs',
  'Ghost',
  'Settings',
  'Memory',
];

// ── Component ─────────────────────────────────────────────────────────────────

export function CommandPalette() {
  const { commandPalette, closeCommandPalette, setCommandQuery, addRecentCommand } =
    useUIStore();
  const { open, query } = commandPalette;

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [results, setResults] = useState<CommandDef[]>([]);
  const [, setRegistryVersion] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Subscribe to registry changes
  useEffect(() => {
    return onRegistryChange(() => setRegistryVersion((v) => v + 1));
  }, []);

  // Update results when query or registry changes
  useEffect(() => {
    if (!open) return;
    const found = searchCommands(query);
    setResults(found);
    setSelectedIndex(0);
  }, [query, open]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Global Cmd+K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        useUIStore.getState().toggleCommandPalette();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Group results by category
  const grouped = useMemo(() => {
    const groups: { category: CommandCategory; commands: CommandDef[] }[] = [];
    const seen = new Set<CommandCategory>();

    // Preserve category order
    for (const cat of CATEGORY_ORDER) {
      const cmds = results.filter((r) => r.category === cat);
      if (cmds.length > 0) {
        groups.push({ category: cat, commands: cmds });
        seen.add(cat);
      }
    }

    // Any categories not in CATEGORY_ORDER
    for (const cmd of results) {
      if (!seen.has(cmd.category)) {
        groups.push({ category: cmd.category, commands: [cmd] });
        seen.add(cmd.category);
      }
    }

    return groups;
  }, [results]);

  // Flat list for keyboard navigation
  const flatResults = useMemo(() => results, [results]);

  const executeCommand = useCallback(
    (cmd: CommandDef) => {
      addRecentCommand(cmd.id);
      closeCommandPalette();
      // Execute after closing to avoid UI conflicts
      requestAnimationFrame(() => cmd.action());
    },
    [addRecentCommand, closeCommandPalette]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatResults[selectedIndex]) {
            executeCommand(flatResults[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          closeCommandPalette();
          break;
      }
    },
    [flatResults, selectedIndex, executeCommand, closeCommandPalette]
  );

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector('[aria-selected="true"]');
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!open) return null;

  // Build a flat index for tracking which result index each grouped item maps to
  let flatIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={closeCommandPalette}
        aria-label="Close command palette"
      />

      {/* Palette */}
      <div
        className="fixed left-1/2 top-[15%] z-50 w-full max-w-xl -translate-x-1/2 rounded-xl border border-[var(--shadow)] bg-[var(--elevated)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-[var(--shadow)] px-4 py-3">
          <svg
            className="h-5 w-5 shrink-0 text-[var(--mist)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-sm text-[var(--ice-white)] placeholder-[var(--mist)] outline-none"
            placeholder="Type a command..."
            value={query}
            onChange={(e) => setCommandQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="rounded border border-[var(--shadow)] bg-[var(--deep-space)] px-1.5 py-0.5 text-[10px] text-[var(--mist)]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
          {flatResults.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-[var(--mist)]">
              No commands found
            </div>
          ) : (
            grouped.map((group) => {
              const groupItems = group.commands.map((cmd) => {
                const idx = flatIndex++;
                return (
                  <CommandResult
                    key={cmd.id}
                    command={cmd}
                    selected={idx === selectedIndex}
                    onExecute={executeCommand}
                    onHover={() => setSelectedIndex(idx)}
                  />
                );
              });

              return (
                <div key={group.category} className="mb-1">
                  <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--mist)]">
                    {group.category}
                  </div>
                  {groupItems}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--shadow)] px-4 py-2">
          <span className="text-[10px] text-[var(--mist)]">
            {flatResults.length} command{flatResults.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2 text-[10px] text-[var(--mist)]">
            <span>↑↓ navigate</span>
            <span>↵ execute</span>
            <span>esc close</span>
          </div>
        </div>
      </div>
    </>
  );
}