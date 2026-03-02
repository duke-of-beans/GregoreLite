'use client';

/**
 * ContextPanel — Left intelligence cockpit panel.
 *
 * 20% width when expanded. 40px icon strip when collapsed.
 * Cmd+B toggles via KeyboardShortcuts handler.
 * Collapse preference persisted in localStorage.
 *
 * Sprint 2B: Context Panel + KERNL UI
 */

import { useEffect } from 'react';
import {
  ContextPanelContext,
  useContextPanel,
  useContextPanelProvider,
} from '@/lib/context/context-provider';
import { useState } from 'react';
import { ProjectSection } from './ProjectSection';
import { SessionSection } from './SessionSection';
import { DecisionList } from './DecisionList';
import { KERNLStatus } from './KERNLStatus';
import { AEGISStatus } from './AEGISStatus';
import { SuggestionSlot } from './SuggestionSlot';
import { EoSIssueRow } from './EoSIssueRow';

// ─── Collapsed icon strip ─────────────────────────────────────────────────────

function CollapsedStrip({ onExpand }: { onExpand: () => void }) {
  return (
    <aside
      className="flex h-full w-10 flex-shrink-0 flex-col items-center border-r border-[var(--shadow)] bg-[var(--elevated)] py-4 gap-4"
      aria-label="Context panel (collapsed)"
    >
      {/* Project dot */}
      <div
        className="h-2 w-2 rounded-full bg-[var(--cyan)]"
        title="Active project"
      />
      {/* Session icon */}
      <span title="Session">
      <svg
        className="h-4 w-4 text-[var(--mist)]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z"
        />
      </svg>
      </span>
      {/* KERNL dot */}
      <div
        className="h-2 w-2 rounded-full bg-[var(--success)]"
        title="KERNL indexed"
      />
      {/* Expand button */}
      <button
        onClick={onExpand}
        className="mt-auto text-[var(--mist)] hover:text-[var(--ice-white)] transition-colors"
        aria-label="Expand context panel (Cmd+B)"
        title="Expand (Cmd+B)"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </aside>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

/** Map health score to a CSS class name for colour coding */
function scoreClass(score: number): string {
  if (score >= 90) return 'text-[var(--success)]';
  if (score >= 70) return 'text-[var(--cyan)]';
  if (score >= 50) return 'text-[var(--warning)]';
  return 'text-[var(--error)]';
}

function PanelContent() {
  const { collapsed, toggleCollapsed, state } = useContextPanel();
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());

  const handleDismissed = (ruleId: string, file: string) => {
    setDismissedKeys((prev) => new Set(prev).add(`${ruleId}:${file}`));
  };

  const visibleIssues = (state.eosSummary?.issues ?? [])
    .filter((i) => !dismissedKeys.has(`${i.ruleId}:${i.file}`))
    .slice(0, 5);

  // Cmd+B keyboard shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        toggleCollapsed();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [toggleCollapsed]);

  if (collapsed) {
    return <CollapsedStrip onExpand={toggleCollapsed} />;
  }

  return (
    <aside
      className="flex h-full w-[20%] min-w-[200px] max-w-[280px] flex-shrink-0 flex-col border-r border-[var(--shadow)] bg-[var(--elevated)] overflow-y-auto"
      aria-label="Context panel"
    >
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-[var(--shadow)] px-4 py-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--mist)]">
          Context
        </span>
        <button
          onClick={toggleCollapsed}
          className="text-[var(--mist)] hover:text-[var(--ice-white)] transition-colors"
          aria-label="Collapse context panel (Cmd+B)"
          title="Collapse (Cmd+B)"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Sections */}
      <ProjectSection />
      <div className="mx-4 h-px bg-[var(--shadow)] opacity-30" />
      <SessionSection />
      <div className="mx-4 h-px bg-[var(--shadow)] opacity-30" />
      <DecisionList />
      <div className="mx-4 h-px bg-[var(--shadow)] opacity-30" />

      {/* Quality section — shown once at least one EoS scan has run */}
      {state.eosSummary && (
        <>
          <div className="px-4 py-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--mist)]">
                Quality
              </span>
              <span className={`text-[11px] font-medium tabular-nums ${scoreClass(state.eosSummary.healthScore)}`}>
                {state.eosSummary.healthScore}/100
              </span>
            </div>
          </div>
          {visibleIssues.length > 0 ? (
            <>
              {visibleIssues.map((issue) => (
                <EoSIssueRow
                  key={`${issue.ruleId}:${issue.file}:${issue.line ?? 0}`}
                  issue={issue}
                  projectId={state.activeProject?.id ?? ''}
                  onDismissed={handleDismissed}
                />
              ))}
              {(state.eosSummary.issues.length - dismissedKeys.size) > 5 && (
                <p className="px-4 pb-1 text-[10px] text-[var(--mist)]">
                  +{state.eosSummary.issues.length - dismissedKeys.size - 5} more issues
                </p>
              )}
            </>
          ) : (
            <p className="px-4 pb-2 text-[11px] text-[var(--success)]">No issues detected</p>
          )}
          <div className="mx-4 h-px bg-[var(--shadow)] opacity-30" />
        </>
      )}

      {/* Status footer */}
      <div className="mt-auto border-t border-[var(--shadow)] py-2">
        <KERNLStatus />
        <AEGISStatus />
        <SuggestionSlot />
      </div>
    </aside>
  );
}

// ─── Exported component (owns context provider) ───────────────────────────────

export function ContextPanel() {
  const ctx = useContextPanelProvider();

  return (
    <ContextPanelContext.Provider value={ctx}>
      <PanelContent />
    </ContextPanelContext.Provider>
  );
}
