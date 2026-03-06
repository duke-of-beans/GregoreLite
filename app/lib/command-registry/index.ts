/**
 * Command Registry — Sprint S9-02
 *
 * Singleton registry of CommandDef objects. Components register commands
 * on mount and unregister on unmount. The CommandPalette reads from here
 * to display filtered results with fuzzy search over label + keywords.
 */

export type CommandCategory =
  | 'Navigation'
  | 'Thread'
  | 'Jobs'
  | 'Ghost'
  | 'Settings'
  | 'Memory';

export interface CommandDef {
  id: string;
  label: string;
  category: CommandCategory;
  shortcut?: string;
  keywords: string[];
  icon?: string;
  action: () => void;
  /** When provided, command only appears if this returns true */
  available?: () => boolean;
}

// ── Singleton Registry ────────────────────────────────────────────────────────

const commands: Map<string, CommandDef> = new Map();
const listeners: Set<() => void> = new Set();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

/** Register a command. Overwrites if id already exists. */
export function registerCommand(cmd: CommandDef): void {
  commands.set(cmd.id, cmd);
  notifyListeners();
}

/** Register multiple commands at once. */
export function registerCommands(cmds: CommandDef[]): void {
  cmds.forEach((cmd) => commands.set(cmd.id, cmd));
  notifyListeners();
}

/** Unregister a command by id. */
export function unregisterCommand(id: string): void {
  commands.delete(id);
  notifyListeners();
}

/** Unregister multiple commands by id. */
export function unregisterCommands(ids: string[]): void {
  ids.forEach((id) => commands.delete(id));
  notifyListeners();
}

/** Get all currently registered commands (filters by available()). */
export function getAvailableCommands(): CommandDef[] {
  const result: CommandDef[] = [];
  commands.forEach((cmd) => {
    if (!cmd.available || cmd.available()) {
      result.push(cmd);
    }
  });
  return result;
}

/** Get all commands without filtering availability (for inspection). */
export function getAllCommands(): CommandDef[] {
  return Array.from(commands.values());
}

/** Subscribe to registry changes. Returns unsubscribe function. */
export function onRegistryChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ── Fuzzy Search ──────────────────────────────────────────────────────────────

/**
 * Simple fuzzy match: every character in the query must appear in the target
 * in order. Returns a score (lower = better match) or -1 for no match.
 */
function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  let score = 0;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (ti === 0 || t[ti - 1] === ' ' || t[ti - 1] === '-') {
        score += 0;
      } else {
        score += ti - qi;
      }
      qi++;
    }
  }

  return qi === q.length ? score : -1;
}

/** Search commands by fuzzy matching query against label + keywords. */
export function searchCommands(query: string): CommandDef[] {
  if (!query.trim()) return getAvailableCommands();

  const results: { cmd: CommandDef; score: number }[] = [];

  getAvailableCommands().forEach((cmd) => {
    let bestScore = fuzzyScore(query, cmd.label);

    for (const kw of cmd.keywords) {
      const kwScore = fuzzyScore(query, kw);
      if (kwScore >= 0 && (bestScore < 0 || kwScore < bestScore)) {
        bestScore = kwScore;
      }
    }

    const catScore = fuzzyScore(query, cmd.category);
    if (catScore >= 0 && (bestScore < 0 || catScore < bestScore)) {
      bestScore = catScore;
    }

    if (bestScore >= 0) {
      results.push({ cmd, score: bestScore });
    }
  });

  results.sort((a, b) => a.score - b.score || a.cmd.label.localeCompare(b.cmd.label));
  return results.map((r) => r.cmd);
}