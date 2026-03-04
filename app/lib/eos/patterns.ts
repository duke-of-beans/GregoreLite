/**
 * EoS Pattern Precognition — TypeScript port
 *
 * Migrated rules (from PatternPrecognition.js):
 *   ✅ MEMORY_LEAK         — setInterval without clearInterval
 *   ✅ EVENT_LISTENER_LEAK — addEventListener without removeEventListener (class scope)
 *
 * Skipped rules:
 *   ❌ MISSING_CONTRACT_METHODS — JS-component-specific (render/destroy/attachTo/toJSON)
 *   ❌ CONSOLE_USAGE_ENHANCED  — ESLint handles this; too noisy in TS projects
 */

import type { RawIssue } from './types';

// ---------------------------------------------------------------------------
// Memory leak detection — setInterval without clearInterval
// ---------------------------------------------------------------------------

/**
 * Detects setInterval calls that have no corresponding clearInterval in the
 * same file. This is a structural signal, not a guarantee — it flags files
 * where the interval is never cleaned up locally, which is the common leak
 * pattern in long-lived components and singletons.
 */
export function detectMemoryLeaks(content: string, filePath: string): RawIssue[] {
  const issues: RawIssue[] = [];
  const lines = content.split('\n');

  const setIntervalCalls: number[] = [];
  const hasClearInterval = content.includes('clearInterval');

  // Only flag if the file sets intervals but never clears them
  if (hasClearInterval) return issues;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.includes('setInterval(') && !line.trim().startsWith('//')) {
      setIntervalCalls.push(i + 1); // 1-based line numbers
    }
  }

  for (const lineNum of setIntervalCalls) {
    issues.push({
      type: 'MEMORY_LEAK',
      severity: 'DANGER',
      file: filePath,
      line: lineNum,
      message: 'setInterval used without clearInterval — potential memory leak',
      description:
        'Intervals created in components or long-lived modules must be cleared on teardown ' +
        '(componentWillUnmount, useEffect cleanup, or class destructor).',
      fix: 'Store the interval ID and call clearInterval(id) in the cleanup path.',
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Event listener leak detection — addEventListener without removeEventListener
// ---------------------------------------------------------------------------

interface ListenerRecord {
  addLine: number;
  event: string;
}

/**
 * Detects addEventListener calls in classes that have no removeEventListener
 * for the same event name in the same file. Targets the most common leak
 * pattern: binding in constructor / connectedCallback without cleanup.
 *
 * Intentionally conservative — only fires when the file has addEventListener
 * with no removeEventListener at all.
 */
export function detectEventListenerLeaks(content: string, filePath: string): RawIssue[] {
  const issues: RawIssue[] = [];

  const hasRemove = content.includes('removeEventListener');
  if (hasRemove) return issues; // File cleans up at least something — skip

  const lines = content.split('\n');
  const addCalls: ListenerRecord[] = [];
  const addPattern = /\.addEventListener\(\s*['"`]([^'"`]+)['"`]/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim().startsWith('//')) continue;
    const match = addPattern.exec(line);
    if (match) {
      addCalls.push({ addLine: i + 1, event: match[1]! });
    }
  }

  // Cap at 5 per file to avoid flooding
  for (const { addLine, event } of addCalls.slice(0, 5)) {
    issues.push({
      type: 'EVENT_LISTENER_LEAK',
      severity: 'WARNING',
      file: filePath,
      line: addLine,
      message: `addEventListener('${event}') used without removeEventListener — potential leak`,
      description:
        'Event listeners added in class constructors or lifecycle methods must be removed ' +
        'in the corresponding teardown to prevent memory leaks.',
      fix: `Call this.element.removeEventListener('${event}', handler) in the cleanup method.`,
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Public analyser — runs both rules
// ---------------------------------------------------------------------------

export function analyzePatterns(content: string, filePath: string): RawIssue[] {
  return [
    ...detectMemoryLeaks(content, filePath),
    ...detectEventListenerLeaks(content, filePath),
  ];
}
