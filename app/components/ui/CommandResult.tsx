/**
 * CommandResult — Sprint S9-02
 *
 * Single result row in the command palette. Shows icon, label, category
 * badge, and keyboard shortcut (if defined). Highlights on selection.
 */

'use client';

import type { CommandDef } from '@/lib/command-registry';

interface CommandResultProps {
  command: CommandDef;
  selected: boolean;
  onExecute: (cmd: CommandDef) => void;
  onHover: () => void;
}

const categoryColors: Record<string, string> = {
  Navigation: 'text-[var(--cyan)] bg-[var(--cyan)]/10 border-[var(--cyan)]/30',
  Thread: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  Jobs: 'text-green-400 bg-green-400/10 border-green-400/30',
  Ghost: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  Settings: 'text-[var(--frost)] bg-[var(--frost)]/10 border-[var(--frost)]/30',
  KERNL: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
};

export function CommandResult({ command, selected, onExecute, onHover }: CommandResultProps) {
  const catStyle =
    categoryColors[command.category] ??
    'text-[var(--mist)] bg-[var(--mist)]/10 border-[var(--mist)]/30';

  return (
    <button
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
        selected
          ? 'bg-[var(--cyan)]/10 text-[var(--ice-white)]'
          : 'text-[var(--frost)] hover:bg-[var(--surface)]'
      }`}
      onClick={() => onExecute(command)}
      onMouseEnter={onHover}
      role="option"
      aria-selected={selected}
    >
      {/* Icon */}
      {command.icon && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--deep-space)] text-sm">
          {command.icon}
        </span>
      )}

      {/* Label */}
      <span className="flex-1 truncate text-sm font-medium">{command.label}</span>

      {/* Category badge */}
      <span
        className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${catStyle}`}
      >
        {command.category}
      </span>

      {/* Shortcut */}
      {command.shortcut && (
        <span className="shrink-0 text-xs text-[var(--mist)]">{command.shortcut}</span>
      )}
    </button>
  );
}